import React, { useState, useEffect } from 'react';
import HeroBanner from '../../components/HeroBanner/HeroBanner';
import BrandHubs from '../../components/BrandHubs/BrandHubs';
import ContentCarousel from '../../components/ContentCarousel/ContentCarousel';
import { useWatchProgress } from '../../contexts/WatchProgressContext';
import { api } from '../../services/api';
import './Home.css';

const Home = () => {
  const { continueWatchingList, watchHistory } = useWatchProgress();

  // Instant pre-cached state initialization for zero layout shift (CLS = 0) and instant 0ms load
  const [initialData] = useState(() => api.getInstantHomeData());

  const [featuredItems, setFeaturedItems] = useState(initialData.featuredItems);
  const [trendingMovies, setTrendingMovies] = useState(initialData.trendingMovies);
  const [trendingSeries, setTrendingSeries] = useState(initialData.trendingSeries);
  const [trendingAnime, setTrendingAnime] = useState(initialData.trendingAnime);
  const [top10Items, setTop10Items] = useState(initialData.top10Items || initialData.topAnime);
  const [recentlyAdded, setRecentlyAdded] = useState(initialData.recentlyAdded || initialData.recentAnime);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadHomeData = async () => {
      try {
        setLoading(true);
        const [
          moviesTrending,
          seriesTrending,
          top10List,
          animeTrending,
          recentList
        ] = await Promise.all([
          api.getTrendingMovies(),
          api.getTrendingSeries(),
          api.getTop10Mixed(),
          api.getTrendingAnime(),
          api.getRecentlyAddedAll()
        ]);

        if (isMounted) {
          setTrendingMovies(moviesTrending);
          setTrendingSeries(seriesTrending);
          setTop10Items(top10List);
          setTrendingAnime(animeTrending);
          setRecentlyAdded(recentList);

          // Build Hero Featured List with top picks from movies and series first
          const heroPicks = [
            ...(moviesTrending.slice(0, 3)),
            ...(seriesTrending.slice(0, 2)),
            ...(animeTrending.slice(0, 1))
          ].filter(Boolean);

          setFeaturedItems(heroPicks.length > 0 ? heroPicks : moviesTrending.slice(0, 5));
        }
      } catch (err) {
        console.error('Error loading home data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadHomeData();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="home-page-container">
      {/* Immersive Billboard Hero */}
      <HeroBanner featuredItems={featuredItems} />

      {/* HBO Max Style Brand / Studio Hubs */}
      <BrandHubs />

      {/* Continue Watching Section (Netflix & Crunchyroll style) */}
      {continueWatchingList && continueWatchingList.length > 0 && (
        <ContentCarousel
          title="Continuar Viendo"
          subtitle="Retoma tus episodios justo donde los dejaste"
          items={continueWatchingList.map(item => ({
            id: item.animeId,
            title: item.animeTitle,
            image: item.image,
            backdrop: item.banner,
            isMovie: item.isMovie
          }))}
          aspect="backdrop"
          progressMap={watchHistory}
        />
      )}

      {/* Top 10 Most Popular (Netflix style with rank numbers - Películas y Series top) */}
      {top10Items && top10Items.length > 0 && (
        <ContentCarousel
          title="Top 10 de Hoy"
          subtitle="Las películas y series más vistas de la semana"
          items={top10Items.slice(0, 10)}
          showRank={true}
          aspect="poster"
        />
      )}

      {/* Popular Movies and Franchises (Warner / HBO Max style) */}
      <ContentCarousel
        title="Películas y Colecciones"
        subtitle="Éxitos de taquilla, sagas completas y cine aclamado"
        items={trendingMovies}
        viewAllLink="/catalog?type=peliculas"
        aspect="poster"
      />

      {/* Western & Prestige TV Series (Apple TV+ / Max style) */}
      <ContentCarousel
        title="Series Populares"
        subtitle="Historias galardonadas y producciones internacionales"
        items={trendingSeries}
        viewAllLink="/catalog?type=series"
        aspect="poster"
      />

      {/* Anime Simulcasts & Hits (Crunchyroll style - Al final, ordenado) */}
      <ContentCarousel
        title="Tendencias en Anime"
        subtitle="Simulcasts y series de animación japonesa en emisión"
        items={trendingAnime}
        viewAllLink="/catalog?type=animes"
        aspect="poster"
      />

      {/* New Releases: Movies, Series, and Anime Truly Mixed */}
      <ContentCarousel
        title="Recién Agregados"
        subtitle="Las últimas películas, series y animes incorporados a la plataforma"
        items={recentlyAdded}
        viewAllLink="/catalog?sort=recent"
        aspect="poster"
      />
    </main>
  );
};

export default Home;
