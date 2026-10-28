import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Hls from 'hls.js';
import {
  Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX,
  Maximize, Minimize, Settings, SkipForward, ArrowRight,
  Server, FastForward, Tv, Check, Eye, EyeOff,
  AlertTriangle, WifiOff, RefreshCw, X
} from 'lucide-react';
import { useWatchProgress } from '../../contexts/WatchProgressContext';
import './AdvancedPlayer.css';

const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds === null) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const AdvancedPlayer = React.forwardRef(({
  animeInfo,
  episodeInfo,
  servers = [],
  activeServer,
  onSelectServer,
  onNextEpisode,
  onPrevEpisode,
  hasNextEpisode = false,
  hasPrevEpisode = false,
  onToggleTheater,
  onOpenShortcutsHelp,
  externalControlsVisible = true,
  onToggleControls,
  isMovie: isMovieProp,
  isSaga: isSagaProp
}, ref) => {
  const { saveProgress, getEpisodeProgress } = useWatchProgress();

  const isMovie = Boolean(
    isMovieProp ||
    animeInfo?.isMovie ||
    animeInfo?.contentType === 'peliculas' ||
    /pel[ií]cula/i.test(animeInfo?.type || '')
  );

  const isSaga = Boolean(
    isSagaProp ||
    animeInfo?.isCollection ||
    /saga|colecci[oó]n/i.test(animeInfo?.title || '') ||
    /saga/i.test(animeInfo?.type || '')
  );

  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const stallTimeoutRef = useRef(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  // Mobile Touch Gestures & Ripple Animations (YouTube/Netflix style)
  const [doubleTapFeedback, setDoubleTapFeedback] = useState(null); // { side: 'left' | 'right', amount: number }
  const tapTimeoutRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);
  const lastTapRef = useRef({ time: 0, x: 0 });
  const lastManualToggleRef = useRef(0);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Modals & Popovers
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showServerMenu, setShowServerMenu] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedResumeTime, setSavedResumeTime] = useState(0);

  // Skip & Next Episode state
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showNextEpisodePrompt, setShowNextEpisodePrompt] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(null);
  const countdownIntervalRef = useRef(null);
  const autoNextTriggeredRef = useRef(false);
  const shouldAutoPlayRef = useRef(false);
  const wasFullscreenRef = useRef(false);
  const [cancelledCountdown, setCancelledCountdown] = useState(false);

  // Scrubber hover state
  const [hoverPosition, setHoverPosition] = useState(null);
  const [hoverTime, setHoverTime] = useState(0);

  // Responsive Viewport Detection (Mobile vs Desktop / TV)
  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Streaming Failover & Error Handling states
  const failedServersRef = useRef(new Set());
  const networkRetryRef = useRef(false);
  const failoverNoticeTimeoutRef = useRef(null);
  const [failoverNotice, setFailoverNotice] = useState(null);
  const [allServersFailed, setAllServersFailed] = useState(false);

  // Reset failover state on episode or anime switch
  useEffect(() => {
    failedServersRef.current.clear();
    networkRetryRef.current = false;
    setAllServersFailed(false);
    setFailoverNotice(null);
  }, [animeInfo?.id, episodeInfo?.id]);

  // Server language filtering inside dropdown
  const [selectedServerLangFilter, setSelectedServerLangFilter] = useState('all');

  const availableServerLangs = useMemo(() => {
    const langs = new Set(servers.map(s => s.lang).filter(Boolean));
    return Array.from(langs);
  }, [servers]);

  const filteredDropdownServers = useMemo(() => {
    if (selectedServerLangFilter === 'all') return servers;
    return servers.filter(s => s.lang === selectedServerLangFilter);
  }, [servers, selectedServerLangFilter]);

  // Check if current server is a direct playable video URL (MP4 / HLS / Rumble / Archive / Arcando)
  const isDirectVideo = Boolean(
    activeServer?.url && (
      activeServer.url.includes('.mp4') ||
      activeServer.url.includes('.m3u8') ||
      activeServer.url.includes('streamproxy') ||
      activeServer.url.includes('.p3x8') ||
      (activeServer.name && /arcando/i.test(activeServer.name)) ||
      activeServer.isDirectMp4 ||
      activeServer.isHls
    )
  );

  // Check if current stream is a 24/7 live transmission (never seek/resume to past chunks)
  const isLiveStream = Boolean(
    (animeInfo?.title && /24\/7|en vivo/i.test(animeInfo.title)) ||
    (episodeInfo?.title && /24\/7|en vivo/i.test(episodeInfo.title)) ||
    (activeServer?.url && /streamproxy|\.p3x8|arcando/i.test(activeServer.url)) ||
    (activeServer?.name && /arcando/i.test(activeServer.name))
  );

  // Poster / Cover art URL for initial state
  const posterUrl = animeInfo?.backdrop || animeInfo?.banner || animeInfo?.image;

  // Reset initial cover or prepare autoplay on episode/anime change
  useEffect(() => {
    if (shouldAutoPlayRef.current) {
      setHasStarted(true);
      setIsPlaying(true);
      setIsBuffering(true);
    } else {
      setHasStarted(false);
      setIsPlaying(false);
    }
    autoNextTriggeredRef.current = false;
    setCancelledCountdown(false);
    setShowNextEpisodePrompt(false);
    setCountdownSeconds(null);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, [animeInfo?.id, episodeInfo?.id]);

  // Resume timestamp check (skip for live 24/7 streams)
  useEffect(() => {
    if (isLiveStream) {
      setShowResumePrompt(false);
      setSavedResumeTime(0);
      return;
    }
    if (animeInfo?.id && episodeInfo?.id) {
      const prev = getEpisodeProgress(animeInfo.id, episodeInfo.season || 1, episodeInfo.id);
      if (prev && prev.currentTime > 15 && prev.percentage < 90) {
        setSavedResumeTime(prev.currentTime);
        setShowResumePrompt(true);
      }
    }
  }, [animeInfo?.id, episodeInfo?.id, isLiveStream]);

  // Stream failover & resilience handler
  const handleStreamFailover = useCallback((failedUrl, reason = '') => {
    if (!failedUrl) return;
    console.warn(`[StreamZona Failover] Server failure detected on: ${failedUrl} (${reason})`);
    failedServersRef.current.add(failedUrl);

    // Find alternative servers that haven't failed yet
    const remainingServers = (servers || []).filter(s => s?.url && !failedServersRef.current.has(s.url));

    if (remainingServers.length > 0) {
      // Prioritize same audio language track if available
      const sameLang = remainingServers.filter(s => s.lang === activeServer?.lang);
      const nextServer = sameLang.length > 0 ? sameLang[0] : remainingServers[0];

      setFailoverNotice(`Error en servidor actual. Cambiando a "${nextServer.name}"...`);
      if (failoverNoticeTimeoutRef.current) clearTimeout(failoverNoticeTimeoutRef.current);
      failoverNoticeTimeoutRef.current = setTimeout(() => {
        setFailoverNotice(null);
      }, 4000);

      onSelectServer(nextServer);
    } else {
      // All servers for this title have failed or no servers available
      setAllServersFailed(true);
      setIsBuffering(false);
      setIsPlaying(false);
    }
  }, [servers, activeServer, onSelectServer]);

  // Video element error event listener
  const handleVideoError = useCallback(() => {
    const video = videoRef.current;
    const err = video?.error;
    console.warn('Video element error encountered:', err?.code, err?.message);
    if (activeServer?.url) {
      handleStreamFailover(activeServer.url, `Video Error Code ${err?.code || 'unknown'}`);
    }
  }, [activeServer?.url, handleStreamFailover]);

  // Manual retry connection
  const handleRetryAllServers = useCallback(() => {
    failedServersRef.current.clear();
    networkRetryRef.current = false;
    setAllServersFailed(false);
    setIsBuffering(true);
    if (servers && servers.length > 0) {
      onSelectServer(servers[0]);
    }
  }, [servers, onSelectServer]);

  // Next Episode auto-advance handler
  const handleAdvanceNextEpisode = useCallback(() => {
    if (autoNextTriggeredRef.current) return;
    autoNextTriggeredRef.current = true;
    setShowNextEpisodePrompt(false);
    setCountdownSeconds(null);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    shouldAutoPlayRef.current = true;
    wasFullscreenRef.current = Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      isFullscreen
    );

    if (onNextEpisode) {
      onNextEpisode();
    }
  }, [onNextEpisode, isFullscreen]);

  // Cancel / dismiss auto countdown
  const handleCancelCountdown = useCallback((e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setCancelledCountdown(true);
    setShowNextEpisodePrompt(false);
    setCountdownSeconds(null);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Active 8-second countdown interval effect
  useEffect(() => {
    if (countdownSeconds === null || !showNextEpisodePrompt) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          handleAdvanceNextEpisode();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [countdownSeconds, showNextEpisodePrompt, handleAdvanceNextEpisode]);

  // Memory Leak Prevention: Complete disposal on component unmount
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video) {
        try {
          video.pause();
          video.removeAttribute('src');
          video.load();
        } catch (e) {}
      }
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
          hlsRef.current = null;
        } catch (e) {}
      }
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      if (failoverNoticeTimeoutRef.current) clearTimeout(failoverNoticeTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Fullscreen Toggle Handler (Safe for all vendors & orientations)
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const isFs = Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    if (!isFs) {
      try {
        const enterPromise = container.requestFullscreen
          ? container.requestFullscreen()
          : container.webkitRequestFullscreen
          ? container.webkitRequestFullscreen()
          : container.mozRequestFullScreen
          ? container.mozRequestFullScreen()
          : container.msRequestFullscreen
          ? container.msRequestFullscreen()
          : null;

        if (enterPromise && typeof enterPromise.then === 'function') {
          enterPromise.then(() => {
            if (window.screen?.orientation?.lock) {
              window.screen.orientation.lock('landscape').catch(() => {});
            }
          }).catch(() => {});
        } else if (window.screen?.orientation?.lock) {
          window.screen.orientation.lock('landscape').catch(() => {});
        }
      } catch (e) {}
    } else {
      try {
        if (window.screen?.orientation?.unlock) {
          try {
            window.screen.orientation.unlock();
          } catch (err) {}
        }

        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      } catch (e) {}
    }
  }, []);

  // Video source loading & HLS setup
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isDirectVideo) return;

    const streamUrl = activeServer?.url;
    if (!streamUrl) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHlsStream = streamUrl.includes('.m3u8') || 
                        streamUrl.includes('streamproxy') || 
                        streamUrl.includes('.p3x8') || 
                        activeServer?.isHls;

    if (isHlsStream && Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        enableWorker: true,
        lowLatencyMode: isLiveStream ? false : true,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        backBufferLength: 30
      });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false);
        if (shouldAutoPlayRef.current) {
          video.play().then(() => {
            setIsPlaying(true);
            setHasStarted(true);
            shouldAutoPlayRef.current = false;
          }).catch(() => {
            video.muted = true;
            video.play().then(() => {
              setIsPlaying(true);
              setHasStarted(true);
              shouldAutoPlayRef.current = false;
            }).catch(() => {
              shouldAutoPlayRef.current = false;
            });
          });

          // Ensure fullscreen is kept seamless across episode transition
          if (wasFullscreenRef.current && !document.fullscreenElement && !document.webkitFullscreenElement) {
            toggleFullscreen();
          }
        } else {
          setIsPlaying(false);
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (!networkRetryRef.current) {
                networkRetryRef.current = true;
                hls.startLoad();
              } else {
                networkRetryRef.current = false;
                hls.destroy();
                handleStreamFailover(streamUrl, 'HLS Network Fatal Error');
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              handleStreamFailover(streamUrl, 'HLS Fatal Error');
              break;
          }
        }
      });
    } else {
      // Native MP4 or Safari native HLS
      video.src = streamUrl;
      video.load();
      if (shouldAutoPlayRef.current) {
        video.play().then(() => {
          setIsPlaying(true);
          setHasStarted(true);
          setIsBuffering(false);
          shouldAutoPlayRef.current = false;
        }).catch(() => {
          video.muted = true;
          video.play().then(() => {
            setIsPlaying(true);
            setHasStarted(true);
            setIsBuffering(false);
            shouldAutoPlayRef.current = false;
          }).catch(() => {
            shouldAutoPlayRef.current = false;
          });
        });

        if (wasFullscreenRef.current && !document.fullscreenElement && !document.webkitFullscreenElement) {
          toggleFullscreen();
        }
      } else {
        setIsPlaying(false);
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeServer?.url, isDirectVideo, isLiveStream, handleStreamFailover, toggleFullscreen]);

  // Smart TV stall recovery
  const handleWaiting = () => {
    setIsBuffering(true);
    if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
    stallTimeoutRef.current = setTimeout(() => {
      const vid = videoRef.current;
      if (vid && !vid.paused && vid.readyState < 3) {
        vid.currentTime += 0.1;
        vid.play().catch(() => {});
      }
    }, 2500);
  };

  const handlePlaying = () => {
    setIsBuffering(false);
    setIsPlaying(true);
    setHasStarted(true);
    if (stallTimeoutRef.current) {
      clearTimeout(stallTimeoutRef.current);
      stallTimeoutRef.current = null;
    }
  };

  // Time & progress tracker
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const curr = video.currentTime;
    const dur = video.duration || 0;
    setCurrentTime(curr);
    setDuration(dur);

    // Buffer range
    if (video.buffered.length > 0) {
      setBufferedTime(video.buffered.end(video.buffered.length - 1));
    }

    // Skip Intro button detection
    if (activeServer?.skip_start && activeServer?.skip_end) {
      const isIntro = curr >= activeServer.skip_start && curr < activeServer.skip_end;
      setShowSkipIntro(isIntro);
    } else {
      setShowSkipIntro(false);
    }

    // Next Episode detection:
    // 1. Official outro metadata: curr >= activeServer.outro_start
    // 2. OR natural end of episode / seeking near end: dur > 20 and curr >= dur - 15
    const isOutroPoint = Boolean(activeServer?.outro_start && curr >= activeServer.outro_start);
    const isNearEnd = Boolean(dur > 20 && curr >= dur - 15);
    const shouldShowNext = hasNextEpisode && (isOutroPoint || isNearEnd) && !cancelledCountdown;

    if (shouldShowNext) {
      setShowNextEpisodePrompt(true);

      // Start 8-second countdown if not already counting down
      if (countdownSeconds === null && !autoNextTriggeredRef.current) {
        const remainingUntilEnd = Math.max(1, Math.ceil(dur - curr));
        const initialCount = isNearEnd && remainingUntilEnd < 8 ? remainingUntilEnd : 8;
        setCountdownSeconds(initialCount);
      }
    } else if (!isOutroPoint && !isNearEnd) {
      setShowNextEpisodePrompt(false);
      setCountdownSeconds(null);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }

    // Periodically save watching progress (skip if live stream)
    if (!isLiveStream && animeInfo && dur > 0) {
      saveProgress({
        animeId: animeInfo.id,
        animeTitle: animeInfo.title,
        episodeId: episodeInfo?.id || 1,
        seasonNumber: episodeInfo?.season || 1,
        episodeTitle: episodeInfo?.title || `Episodio ${episodeInfo?.id || 1}`,
        currentTime: curr,
        duration: dur,
        image: animeInfo.image,
        banner: animeInfo.banner,
        isMovie: animeInfo.isMovie
      });
    }
  };

  const effectiveControlsVisible = externalControlsVisible && controlsVisible;

  // Control bar auto-hide after 2 seconds of inactivity while playing (paused when menus are open)
  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying && externalControlsVisible && !showServerMenu && !showSettingsMenu) {
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
        setShowSettingsMenu(false);
        setShowServerMenu(false);
      }, 2000);
    }
  }, [isPlaying, externalControlsVisible, showServerMenu, showSettingsMenu]);

  // Handle mouse move on player container: ignores jitter right after click-to-hide
  const handleContainerMouseMove = useCallback((e) => {
    // If user recently clicked to toggle controls (within 800ms), ignore click release motion
    if (Date.now() - lastManualToggleRef.current < 800) {
      return;
    }

    const dx = Math.abs(e.clientX - lastMousePosRef.current.x);
    const dy = Math.abs(e.clientY - lastMousePosRef.current.y);

    // Filter out micro-movements/jitter under 4px
    if (dx < 4 && dy < 4) {
      return;
    }

    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  useEffect(() => {
    if (isPlaying && externalControlsVisible) {
      resetControlsTimeout();
    } else {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      setControlsVisible(true);
    }
  }, [isPlaying, externalControlsVisible, resetControlsTimeout]);

  // Control bar auto-hide alias
  const triggerControls = useCallback(() => {
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // Keyboard navigation & remote control shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept typing in input fields
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
        case 'j':
        case 'J':
          e.preventDefault();
          seekDelta(-10);
          break;
        case 'ArrowRight':
        case 'l':
        case 'L':
          e.preventDefault();
          seekDelta(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(v => Math.min(1, v + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(v => Math.max(0, v - 0.1));
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          setIsMuted(m => !m);
          break;
        case 'n':
        case 'N':
          if (hasNextEpisode && onNextEpisode) {
            e.preventDefault();
            onNextEpisode();
          }
          break;
        case 'p':
        case 'P':
          if (hasPrevEpisode && onPrevEpisode) {
            e.preventDefault();
            onPrevEpisode();
          }
          break;
        case 'i':
        case 'I':
          e.preventDefault();
          handleSkipIntroClick();
          break;
        case 't':
        case 'T':
          if (onToggleTheater) {
            e.preventDefault();
            onToggleTheater();
          }
          break;
        case '?':
          if (onOpenShortcutsHelp) {
            e.preventDefault();
            onOpenShortcutsHelp();
          }
          break;
        default:
          break;
      }
      triggerControls();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, triggerControls, hasNextEpisode, onNextEpisode, hasPrevEpisode, onPrevEpisode, onToggleTheater, onOpenShortcutsHelp]);

  // Fullscreen event listener (handles Escape key, browser buttons, and gestures seamlessly)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);

      // Unlock screen orientation when leaving fullscreen
      if (!isCurrentlyFullscreen && window.screen?.orientation?.unlock) {
        try {
          window.screen.orientation.unlock();
        } catch (err) {}
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Volume change sync
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Playback speed sync
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const togglePlay = () => {
    if (isDirectVideo) {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) {
        video.play().then(() => {
          setIsPlaying(true);
          setHasStarted(true);
        }).catch(() => {
          setHasStarted(true);
        });
      } else {
        video.pause();
        setIsPlaying(false);
      }
    } else {
      setHasStarted(true);
    }
    triggerControls();
  };

  const seekDelta = (seconds) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
    triggerControls();
  };

  // Trigger YouTube/Netflix style double-tap feedback ripple
  const triggerDoubleTapRipple = useCallback((side) => {
    setDoubleTapFeedback((prev) => {
      const isSameSide = prev?.side === side;
      return {
        side,
        amount: isSameSide ? prev.amount + 10 : 10
      };
    });

    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = setTimeout(() => {
      setDoubleTapFeedback(null);
    }, 650);

    triggerControls();
  }, [triggerControls]);

  // Touch gesture & surface click handler: distinguishes single tap vs double-tap seek
  const handlePlayerSurfaceTap = (e) => {
    if (!hasStarted) {
      togglePlay();
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const clientX = e.clientX ?? (e.changedTouches && e.changedTouches[0]?.clientX) ?? 0;
    const relativeX = (clientX - rect.left) / rect.width;
    const now = Date.now();
    const timeSinceLast = now - lastTapRef.current.time;

    if (timeSinceLast > 0 && timeSinceLast < 280) {
      // Double tap / double click detected! Clear pending single tap timeout
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }

      if (relativeX < 0.40) {
        // Left 40%: Seek -10s
        seekDelta(-10);
        triggerDoubleTapRipple('left');
      } else if (relativeX > 0.60) {
        // Right 40%: Seek +10s
        seekDelta(10);
        triggerDoubleTapRipple('right');
      } else {
        // Center: Toggle Play/Pause
        togglePlay();
      }

      lastTapRef.current = { time: 0, x: 0 };
    } else {
      // Single tap / click: toggle controls smoothly
      lastTapRef.current = { time: now, x: clientX };
      tapTimeoutRef.current = setTimeout(() => {
        lastManualToggleRef.current = Date.now();
        setControlsVisible((prev) => {
          const next = !prev;
          if (next) {
            resetControlsTimeout();
          } else {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            setShowSettingsMenu(false);
            setShowServerMenu(false);
          }
          return next;
        });
        tapTimeoutRef.current = null;
      }, 160);
    }
  };

  const handleScrubberChange = (e) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const newPercentage = parseFloat(e.target.value);
    const newTime = (newPercentage / 100) * duration;
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleScrubberMouseMove = (e) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const clampedPos = Math.max(0, Math.min(1, pos));
    setHoverPosition(clampedPos * 100);
    setHoverTime(clampedPos * duration);
  };

  const handleSkipIntroClick = () => {
    const video = videoRef.current;
    if (video) {
      if (activeServer?.skip_end) {
        video.currentTime = activeServer.skip_end;
      } else {
        video.currentTime = Math.min((video.duration || 999999), video.currentTime + 85);
      }
      setShowSkipIntro(false);
    }
  };

  const handleResumeAccept = () => {
    if (videoRef.current && savedResumeTime > 0) {
      videoRef.current.currentTime = savedResumeTime;
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        setHasStarted(true);
      }).catch(() => {});
    }
    setHasStarted(true);
    setShowResumePrompt(false);
  };

  React.useImperativeHandle(ref, () => ({
    toggleFullscreen,
    togglePlay,
    seekDelta,
    setControlsVisible: (val) => setControlsVisible(val)
  }));

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPercent = duration > 0 ? (bufferedTime / duration) * 100 : 0;

  // Portal target for mobile bottom sheets (escapes overflow:hidden while maintaining fullscreen visibility)
  const portalTarget = typeof document !== 'undefined'
    ? ((isFullscreen && containerRef.current) ? containerRef.current : document.body)
    : null;

  return (
    <div
      ref={containerRef}
      className={`advanced-player-container ${effectiveControlsVisible ? 'controls-active' : 'controls-hidden'} ${isFullscreen ? 'fullscreen' : ''}`}
      onMouseMove={handleContainerMouseMove}
    >
      {/* Video Engine: Failover Error View / Direct Video / Embed Fallback */}
      {allServersFailed || !activeServer?.url ? (
        <div className="player-error-fallback-view fade-in">
          <div className="player-error-card glass-panel">
            <div className="error-icon-circle">
              <WifiOff size={32} />
            </div>
            <h3 className="error-card-title">Servidor no disponible</h3>
            <p className="error-card-desc">
              {servers.length === 0 || !activeServer?.url
                ? 'No hay servidores configurados para este contenido todavía.'
                : 'No se pudo conectar con el servidor actual o el enlace ha expirado.'}
            </p>
            <div className="error-card-actions">
              {servers.length > 1 && (
                <button
                  type="button"
                  className="btn-accent error-action-btn"
                  onClick={handleRetryAllServers}
                >
                  <RefreshCw size={16} />
                  <span>Reintentar Conexión</span>
                </button>
              )}
              {servers.length > 0 && (
                <button
                  type="button"
                  className="btn-secondary error-action-btn"
                  onClick={() => setShowServerMenu(true)}
                >
                  <Server size={16} />
                  <span>Elegir otro servidor ({servers.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : isDirectVideo ? (
        <video
          ref={videoRef}
          className="advanced-video-element"
          poster={posterUrl}
          playsInline
          onError={handleVideoError}
          onPlay={() => {
            setIsPlaying(true);
            setHasStarted(true);
          }}
          onTimeUpdate={handleTimeUpdate}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            if (hasNextEpisode) {
              handleAdvanceNextEpisode();
            }
          }}
        />
      ) : (
        /* Embed fallback for external provider iframes */
        <iframe
          src={activeServer?.url}
          title={animeInfo?.title || 'Reproductor'}
          className="advanced-iframe-element"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      )}

      {/* Dynamic Server Failover Toast Notification */}
      {failoverNotice && (
        <div className="player-failover-toast fade-in">
          <AlertTriangle size={18} className="toast-icon-warning" />
          <span>{failoverNotice}</span>
        </div>
      )}

      {/* Transparent Gesture Layer: Single tap toggles UI, Double tap left/right seeks ±10s */}
      {isDirectVideo && hasStarted && (
        <div
          className="player-gesture-surface"
          onClick={handlePlayerSurfaceTap}
          aria-hidden="true"
        />
      )}

      {/* Double-Tap Seeking Ripple Overlay (YouTube/Netflix Style) */}
      {doubleTapFeedback && (
        <div className={`player-double-tap-ripple ${doubleTapFeedback.side} fade-in`}>
          <div className="ripple-wave-circle" />
          <div className="ripple-badge">
            {doubleTapFeedback.side === 'left' ? (
              <RotateCcw size={32} className="ripple-icon" />
            ) : (
              <RotateCw size={32} className="ripple-icon" />
            )}
            <span className="ripple-seconds-text">
              {doubleTapFeedback.side === 'left' ? `-${doubleTapFeedback.amount}s` : `+${doubleTapFeedback.amount}s`}
            </span>
          </div>
        </div>
      )}

      {/* Central Play/Pause Action Button Overlay (Mobile & Desktop) */}
      {isDirectVideo && hasStarted && (
        <div className={`player-center-play-overlay ${effectiveControlsVisible || !isPlaying ? 'visible' : 'hidden'}`}>
          <button
            type="button"
            className="player-center-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? (
              <Pause size={38} fill="#ffffff" color="#ffffff" />
            ) : (
              <Play size={38} fill="#ffffff" color="#ffffff" style={{ marginLeft: 4 }} />
            )}
          </button>
        </div>
      )}

      {/* Initial Cover / Poster Image Overlay before playback starts */}
      {!hasStarted && isDirectVideo && posterUrl && (
        <div
          className="player-initial-poster-overlay fade-in"
          onClick={togglePlay}
          title="Haz clic para reproducir"
        >
          <img
            src={posterUrl}
            alt={animeInfo?.title}
            className="player-initial-poster-img"
          />
          <div className="player-initial-poster-vignette" />

          <button
            className="player-initial-big-play-btn"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            aria-label="Reproducir"
            title="Reproducir"
          >
            <Play size={40} fill="#fff" color="#fff" />
          </button>
        </div>
      )}

      {/* Buffering Spinner */}
      {isBuffering && isDirectVideo && (
        <div className="player-buffering-overlay">
          <div className="player-spinner" />
          <span className="player-buffering-text">Cargando stream...</span>
        </div>
      )}



      {/* Resume Prompt Dialog (Perfectamente centrado en el reproductor) */}
      {showResumePrompt && (
        <div className="player-resume-backdrop">
          <div className="player-resume-modal glass-panel" onClick={e => e.stopPropagation()}>
            <div className="resume-icon-badge">
              <RotateCcw size={26} />
            </div>
            <h3 className="resume-modal-title">¿Deseas continuar viendo?</h3>
            <p className="resume-text">
              Te quedaste en el minuto <strong>{formatTime(savedResumeTime)}</strong>
            </p>
            <div className="resume-actions">
              <button className="btn-accent resume-confirm-btn" onClick={handleResumeAccept}>
                <Play size={17} fill="currentColor" />
                <span>Continuar</span>
              </button>
              <button className="btn-secondary resume-restart-btn" onClick={() => setShowResumePrompt(false)}>
                <RotateCcw size={15} />
                <span>Desde el inicio</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Skip Intro Button (Kept visible in clean mode) */}
      {showSkipIntro && isDirectVideo && (
        <button
          className="floating-skip-btn intro fade-in"
          onClick={handleSkipIntroClick}
        >
          <FastForward size={18} />
          <span>Saltar Intro</span>
        </button>
      )}

      {/* Floating Siguiente Episodio Card (Glassmorphic, Compact & Clean with 8s Countdown) */}
      {showNextEpisodePrompt && hasNextEpisode && (
        <div
          className="player-next-countdown-card glass-panel fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="countdown-info">
            <span className="countdown-label">
              {countdownSeconds !== null ? `Siguiente episodio en ${countdownSeconds}s` : '¿Ver siguiente episodio?'}
            </span>
            <span className="countdown-number">
              {countdownSeconds !== null ? `${countdownSeconds}s` : 'Siguiente'}
            </span>
          </div>

          <button
            type="button"
            className="btn-accent countdown-play-now"
            onClick={handleAdvanceNextEpisode}
            title="Reproducir siguiente ahora"
          >
            <SkipForward size={14} />
            <span>Siguiente</span>
          </button>

          <button
            type="button"
            className="countdown-dismiss-btn"
            onClick={handleCancelCountdown}
            title="Cancelar cuenta regresiva"
            aria-label="Cancelar cuenta regresiva"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Header Bar inside Player */}
      <div
        className="player-top-bar"
        onClick={(e) => {
          if (e.target === e.currentTarget || e.target.classList.contains('player-title-info')) {
            handlePlayerSurfaceTap(e);
          }
        }}
      >
        <div className="player-title-info">
          <h2 className="player-anime-title">{animeInfo?.title}</h2>
          <span className="player-episode-subtitle">
            {isMovie
              ? 'Película Completa'
              : isSaga
                ? (episodeInfo?.title && episodeInfo.title !== animeInfo?.title ? episodeInfo.title : 'Película de la saga')
                : (episodeInfo?.title && !episodeInfo.title.toLowerCase().startsWith('episodio')
                    ? `T${episodeInfo?.season || 1} • ${episodeInfo.title}`
                    : `Temporada ${episodeInfo?.season || 1} • Episodio ${episodeInfo?.id || 1}`)}
          </span>
        </div>

        <div className="player-top-actions">
          {/* Server Switcher Pill */}
          <button
            className="player-server-pill-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowServerMenu(prev => !prev);
              setShowSettingsMenu(false);
            }}
          >
            <Server size={15} />
            <span>{activeServer?.name || 'Servidores'}</span>
            <span className="server-lang-badge">{activeServer?.lang || 'SUB'}</span>
          </button>

          {/* Desktop Server Dropdown (Clean Popover) */}
          {!isMobileView && showServerMenu && (
            <div className="player-servers-dropdown glass-panel fade-in" onClick={e => e.stopPropagation()}>
              <div className="dropdown-header-row">
                <h4 className="dropdown-title">Servidores Disponibles</h4>
                <span className="dropdown-count-badge">{filteredDropdownServers.length}</span>
              </div>

              {availableServerLangs.length > 1 && (
                <div className="dropdown-lang-tabs">
                  <button
                    className={`lang-tab-pill ${selectedServerLangFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedServerLangFilter('all')}
                  >
                    Todos
                  </button>
                  {availableServerLangs.map(lang => (
                    <button
                      key={lang}
                      className={`lang-tab-pill ${selectedServerLangFilter === lang ? 'active' : ''}`}
                      onClick={() => setSelectedServerLangFilter(lang)}
                    >
                      {lang === 'latino' ? 'Latino' : lang === 'castellano' ? 'Castellano' : lang === 'sub' ? 'Sub' : lang.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}

              <div className="servers-list">
                {filteredDropdownServers.map((srv, idx) => (
                  <button
                    key={srv.url || idx}
                    className={`server-option-btn ${activeServer?.url === srv.url ? 'active' : ''}`}
                    onClick={() => {
                      onSelectServer(srv);
                      setShowServerMenu(false);
                    }}
                  >
                    <div className="server-opt-left">
                      <span className="server-opt-name">{srv.name}</span>
                      <span className="server-opt-desc">{srv.description || (srv.lang ? `Audio ${srv.lang.toUpperCase()}` : '')}</span>
                    </div>
                    <div className="server-opt-badges">
                      {srv.isDirectMp4 && <span className="srv-badge mp4">MP4</span>}
                      {srv.isHls && <span className="srv-badge hls">HLS</span>}
                      {srv.lang && <span className="srv-badge lang">{srv.lang?.toUpperCase()}</span>}
                      {activeServer?.url === srv.url && <Check size={16} className="srv-check" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Sheet for Servers (Escapes Player Container via Portal) */}
      {isMobileView && showServerMenu && portalTarget && createPortal(
        <div
          className="mobile-bottom-sheet-backdrop fade-in"
          onClick={() => setShowServerMenu(false)}
        >
          <div
            className="mobile-bottom-sheet-panel glass-panel"
            onClick={e => e.stopPropagation()}
          >
            <div className="sheet-grab-handle" />

            <div className="sheet-header-row">
              <div className="sheet-title-info">
                <Server size={20} className="sheet-title-icon" />
                <h3 className="sheet-main-title">Servidores Disponibles</h3>
                <span className="sheet-badge-count">{filteredDropdownServers.length}</span>
              </div>
              <button
                className="sheet-close-btn"
                onClick={() => setShowServerMenu(false)}
                aria-label="Cerrar panel de servidores"
              >
                <X size={20} />
              </button>
            </div>

            {availableServerLangs.length > 1 && (
              <div className="sheet-lang-tabs-bar">
                <button
                  className={`sheet-lang-pill ${selectedServerLangFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedServerLangFilter('all')}
                >
                  Todos
                </button>
                {availableServerLangs.map(lang => (
                  <button
                    key={lang}
                    className={`sheet-lang-pill ${selectedServerLangFilter === lang ? 'active' : ''}`}
                    onClick={() => setSelectedServerLangFilter(lang)}
                  >
                    {lang === 'latino' ? 'Latino' : lang === 'castellano' ? 'Castellano' : lang === 'sub' ? 'Sub' : lang.toUpperCase()}
                  </button>
                ))}
              </div>
            )}

            <div className="sheet-servers-scroll-list">
              {filteredDropdownServers.map((srv, idx) => {
                const isActive = activeServer?.url === srv.url;
                return (
                  <button
                    key={srv.url || idx}
                    className={`sheet-server-card ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      onSelectServer(srv);
                      setShowServerMenu(false);
                    }}
                  >
                    <div className="sheet-server-left">
                      <span className="sheet-server-name">{srv.name}</span>
                      <span className="sheet-server-desc">
                        {srv.description || (srv.lang ? `Audio ${srv.lang.toUpperCase()}` : 'Servidor de Streaming')}
                      </span>
                    </div>
                    <div className="sheet-server-right">
                      {srv.isDirectMp4 && <span className="sheet-tag mp4">MP4</span>}
                      {srv.isHls && <span className="sheet-tag hls">HLS</span>}
                      {srv.lang && <span className="sheet-tag lang">{srv.lang?.toUpperCase()}</span>}
                      {isActive && (
                        <div className="sheet-active-check">
                          <Check size={18} />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        portalTarget
      )}

      {/* Bottom Custom Controls Bar */}
      {isDirectVideo && (
        <div
          className="player-bottom-controls"
          onClick={(e) => {
            if (e.target === e.currentTarget) handlePlayerSurfaceTap(e);
          }}
        >
          {/* Mobile-First Dedicated Time Row above Scrubber (Left: current, Right: total) */}
          <div className="player-scrubber-time-row">
            <span className="scrubber-time-current">{formatTime(currentTime)}</span>
            <span className="scrubber-time-total">{formatTime(duration)}</span>
          </div>

          {/* Custom Timeline Scrubber */}
          <div
            className="player-scrubber-wrapper"
            onMouseMove={handleScrubberMouseMove}
            onMouseLeave={() => setHoverPosition(null)}
          >
            {/* Hover Tooltip */}
            {hoverPosition !== null && (
              <div
                className="scrubber-hover-tooltip"
                style={{ left: `${hoverPosition}%` }}
              >
                {formatTime(hoverTime)}
              </div>
            )}

            <div className="scrubber-track-background">
              <div
                className="scrubber-buffered-fill"
                style={{ width: `${bufferPercent}%` }}
              />
              <div
                className="scrubber-played-fill"
                style={{ width: `${progressPercent}%` }}
              />
              <div
                className="scrubber-handle-thumb"
                style={{ left: `${progressPercent}%` }}
              />
            </div>

            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={progressPercent || 0}
              onChange={handleScrubberChange}
              className="scrubber-range-input"
              aria-label="Barra de reproducción"
            />
          </div>

          {/* Action Icons Row */}
          <div className="player-controls-row">
            {/* Left Controls: Desktop Buttons, Volume, Episode Navigation */}
            <div className="controls-group-left">
              <button
                className="control-btn play-pause-btn desktop-only-btn"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
              </button>

              <button
                className="control-btn seek-btn desktop-only-btn"
                onClick={() => seekDelta(-10)}
                aria-label="Retroceder 10 segundos"
                title="Retroceder 10s"
              >
                <RotateCcw size={20} />
              </button>

              <button
                className="control-btn seek-btn desktop-only-btn"
                onClick={() => seekDelta(10)}
                aria-label="Adelantar 10 segundos"
                title="Adelantar 10s"
              >
                <RotateCw size={20} />
              </button>

              {/* Volume Slider (Hidden on Mobile) */}
              <div className="volume-control-wrap">
                <button
                  className="control-btn volume-btn"
                  onClick={() => setIsMuted(m => !m)}
                  aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
                >
                  {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(parseFloat(e.target.value));
                    setIsMuted(false);
                  }}
                  className="volume-slider-input"
                  aria-label="Volumen"
                />
              </div>

              {/* Time Display (Visible on Desktop) */}
              <div className="player-time-display desktop-time-display">
                <span className="current-time">{formatTime(currentTime)}</span>
                <span className="time-separator">/</span>
                <span className="total-duration">{formatTime(duration)}</span>
              </div>

              {/* Previous Episode Navigation */}
              {hasPrevEpisode && (
                <button
                  className="control-btn ep-nav-btn"
                  onClick={onPrevEpisode}
                  aria-label="Episodio anterior"
                  title="Episodio Anterior"
                >
                  <RotateCcw size={18} />
                </button>
              )}

              {/* Next Episode Navigation */}
              {hasNextEpisode && (
                <button
                  className="control-btn ep-nav-btn"
                  onClick={onNextEpisode}
                  aria-label="Siguiente episodio"
                  title="Siguiente Episodio"
                >
                  <SkipForward size={20} />
                </button>
              )}
            </div>

            {/* Right Controls: Settings, Clean View, Fullscreen */}
            <div className="controls-group-right">
              {/* Settings / Speed Popover Trigger */}
              <div className="settings-menu-wrapper">
                <button
                  className="control-btn"
                  onClick={() => {
                    setShowSettingsMenu(prev => !prev);
                    setShowServerMenu(false);
                  }}
                  aria-label="Configuraciones"
                  title="Velocidad y Calidad"
                >
                  <Settings size={20} />
                </button>

                {/* Desktop Settings / Speed Popover */}
                {!isMobileView && showSettingsMenu && (
                  <div className="player-settings-dropdown glass-panel fade-in">
                    <h5 className="settings-heading">Velocidad de reproducción</h5>
                    <div className="speed-options-grid">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                        <button
                          key={speed}
                          className={`speed-option-btn ${playbackSpeed === speed ? 'active' : ''}`}
                          onClick={() => {
                            setPlaybackSpeed(speed);
                            setShowSettingsMenu(false);
                          }}
                        >
                          {speed === 1 ? 'Normal' : `${speed}x`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Fullscreen Toggle */}
              <button
                className="control-btn fullscreen-btn"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                title="Pantalla Completa"
              >
                {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet for Settings / Speed (Escapes Player Container via Portal) */}
      {isMobileView && showSettingsMenu && portalTarget && createPortal(
        <div
          className="mobile-bottom-sheet-backdrop fade-in"
          onClick={() => setShowSettingsMenu(false)}
        >
          <div
            className="mobile-bottom-sheet-panel glass-panel"
            onClick={e => e.stopPropagation()}
          >
            <div className="sheet-grab-handle" />

            <div className="sheet-header-row">
              <div className="sheet-title-info">
                <Settings size={20} className="sheet-title-icon" />
                <h3 className="sheet-main-title">Velocidad de Reproducción</h3>
              </div>
              <button
                className="sheet-close-btn"
                onClick={() => setShowSettingsMenu(false)}
                aria-label="Cerrar panel de velocidad"
              >
                <X size={20} />
              </button>
            </div>

            <div className="sheet-speed-options-grid">
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                <button
                  key={speed}
                  className={`sheet-speed-btn ${playbackSpeed === speed ? 'active' : ''}`}
                  onClick={() => {
                    setPlaybackSpeed(speed);
                    setShowSettingsMenu(false);
                  }}
                >
                  <span className="speed-num">{speed === 1 ? 'Normal (1.0x)' : `${speed}x`}</span>
                  {playbackSpeed === speed && <Check size={18} className="sheet-check" />}
                </button>
              ))}
            </div>
          </div>
        </div>,
        portalTarget
      )}
    </div>
  );
});

export default AdvancedPlayer;
