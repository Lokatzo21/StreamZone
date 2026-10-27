import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX,
  Maximize, Minimize, Settings, SkipForward, ArrowRight,
  Server, FastForward, Tv, Check, Eye, EyeOff
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

const AdvancedPlayer = ({
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
  onOpenShortcutsHelp
}) => {
  const { saveProgress, getEpisodeProgress } = useWatchProgress();

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

  // Modals & Popovers
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showServerMenu, setShowServerMenu] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedResumeTime, setSavedResumeTime] = useState(0);

  // Skip & Next Episode state
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showNextEpisodePrompt, setShowNextEpisodePrompt] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(null);
  const [cleanViewMode, setCleanViewMode] = useState(false);

  // Scrubber hover state
  const [hoverPosition, setHoverPosition] = useState(null);
  const [hoverTime, setHoverTime] = useState(0);

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

  // Reset initial cover on episode/anime change
  useEffect(() => {
    setHasStarted(false);
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
        setIsPlaying(false);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });
    } else {
      // Native MP4 or Safari native HLS
      video.src = streamUrl;
      video.load();
      setIsPlaying(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeServer?.url, isDirectVideo]);

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

    // Next Episode detection: either by outro_start metadata OR near the end (last 90s, or when user seeks to the end)
    const isNearEnd = hasNextEpisode && (
      (activeServer?.outro_start && curr >= activeServer.outro_start) ||
      (dur > 40 && curr >= dur - 90)
    );
    setShowNextEpisodePrompt(Boolean(isNearEnd));

    // Next episode auto countdown during final 15 seconds
    if (hasNextEpisode && dur > 20 && curr >= dur - 15) {
      const remaining = Math.max(1, Math.ceil(dur - curr));
      setCountdownSeconds(remaining);
    } else {
      setCountdownSeconds(null);
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

  // Control bar auto-hide
  const triggerControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setControlsVisible(false);
        setShowSettingsMenu(false);
        setShowServerMenu(false);
      }
    }, 3500);
  }, [isPlaying]);

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
    if (!hasStarted) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const clientX = e.clientX ?? (e.changedTouches && e.changedTouches[0]?.clientX) ?? 0;
    const relativeX = (clientX - rect.left) / rect.width;
    const now = Date.now();
    const timeSinceLast = now - lastTapRef.current.time;

    if (timeSinceLast > 0 && timeSinceLast < 320) {
      // Double tap detected! Clear pending single tap timeout
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
      // Single tap candidate
      lastTapRef.current = { time: now, x: clientX };
      tapTimeoutRef.current = setTimeout(() => {
        setControlsVisible((prev) => {
          const next = !prev;
          if (next) triggerControls();
          return next;
        });
        tapTimeoutRef.current = null;
      }, 260);
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

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    const isFs = Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    if (!isFs) {
      const enterPromise = container.requestFullscreen
        ? container.requestFullscreen()
        : container.webkitRequestFullscreen
        ? container.webkitRequestFullscreen()
        : container.mozRequestFullScreen
        ? container.mozRequestFullScreen()
        : container.msRequestFullscreen
        ? container.msRequestFullscreen()
        : null;

      if (enterPromise && enterPromise.then) {
        enterPromise.then(() => {
          // Attempt mobile landscape lock for optimal viewing
          if (window.screen?.orientation?.lock) {
            window.screen.orientation.lock('landscape').catch(() => {});
          }
        }).catch(() => {});
      } else {
        if (window.screen?.orientation?.lock) {
          window.screen.orientation.lock('landscape').catch(() => {});
        }
      }
    } else {
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
    }
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

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPercent = duration > 0 ? (bufferedTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`advanced-player-container ${controlsVisible ? 'controls-active' : 'controls-hidden'} ${isFullscreen ? 'fullscreen' : ''} ${cleanViewMode ? 'clean-view-mode-active' : ''}`}
      onMouseMove={triggerControls}
    >
      {/* Video Engine: Native Video Player for MP4 / HLS */}
      {isDirectVideo ? (
        <video
          ref={videoRef}
          className="advanced-video-element"
          poster={posterUrl}
          playsInline
          onPlay={() => {
            setIsPlaying(true);
            setHasStarted(true);
          }}
          onTimeUpdate={handleTimeUpdate}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            if (hasNextEpisode && onNextEpisode) onNextEpisode();
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
        <div
          className={`player-center-play-overlay ${controlsVisible || !isPlaying ? 'visible' : 'hidden'}`}
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
        >
          <button
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
      {!hasStarted && posterUrl && (
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

      {/* Exit Clean View Mode Floating Button */}
      {cleanViewMode && (
        <button
          className="floating-clean-view-exit-btn fade-in"
          onClick={() => setCleanViewMode(false)}
          title="Restaurar controles y servidores"
        >
          <Eye size={17} />
          <span>Restaurar Controles</span>
        </button>
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

      {/* Floating Siguiente Episodio Card (Kept visible in clean mode near end / outro) */}
      {showNextEpisodePrompt && hasNextEpisode && (
        <div className="player-next-countdown-card glass-panel fade-in">
          <div className="countdown-info">
            <span className="countdown-label">
              {countdownSeconds !== null ? `Siguiente Episodio en ${countdownSeconds}s` : '¿Ver siguiente episodio?'}
            </span>
            <span className="countdown-number">
              {countdownSeconds !== null ? `${countdownSeconds}s` : 'Siguiente'}
            </span>
          </div>
          <button className="btn-accent countdown-play-now" onClick={onNextEpisode}>
            <SkipForward size={16} />
            <span>Siguiente Episodio</span>
          </button>
        </div>
      )}

      {/* Top Header Bar inside Player */}
      <div className="player-top-bar">
        <div className="player-title-info">
          <h2 className="player-anime-title">{animeInfo?.title}</h2>
          <span className="player-episode-subtitle">
            {episodeInfo?.title || `Episodio ${episodeInfo?.id || 1}`}
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

          {/* Server Dropdown */}
          {showServerMenu && (
            <div className="player-servers-dropdown glass-panel fade-in" onClick={e => e.stopPropagation()}>
              <h4 className="dropdown-title">Servidores Disponibles</h4>
              <div className="servers-list">
                {servers.map((srv, idx) => (
                  <button
                    key={idx}
                    className={`server-option-btn ${activeServer?.url === srv.url ? 'active' : ''}`}
                    onClick={() => {
                      onSelectServer(srv);
                      setShowServerMenu(false);
                    }}
                  >
                    <div className="server-opt-left">
                      <span className="server-opt-name">{srv.name}</span>
                      <span className="server-opt-desc">{srv.description}</span>
                    </div>
                    <div className="server-opt-badges">
                      {srv.isDirectMp4 && <span className="srv-badge mp4">MP4</span>}
                      {srv.isHls && <span className="srv-badge hls">HLS</span>}
                      <span className="srv-badge lang">{srv.lang?.toUpperCase()}</span>
                      {activeServer?.url === srv.url && <Check size={16} className="srv-check" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Custom Controls Bar */}
      {isDirectVideo && (
        <div className="player-bottom-controls" onClick={e => e.stopPropagation()}>
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

                {showSettingsMenu && (
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

              {/* Clean View Mode Toggle (Ojo con línea en diagonal - Oculta interfaz y servidores) */}
              <button
                className={`control-btn clean-view-btn ${cleanViewMode ? 'active' : ''}`}
                onClick={() => setCleanViewMode(prev => !prev)}
                aria-label={cleanViewMode ? 'Restaurar controles' : 'Modo Vista Limpia (Ocultar interfaz)'}
                title={cleanViewMode ? 'Mostrar interfaz completa' : 'Modo Vista Limpia (Ocultar controles y servidores)'}
              >
                {cleanViewMode ? <Eye size={20} /> : <EyeOff size={20} />}
              </button>

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
    </div>
  );
};

export default AdvancedPlayer;
