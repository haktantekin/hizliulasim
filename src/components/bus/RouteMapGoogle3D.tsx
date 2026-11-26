'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BusFront, Pause, Play, Route, SkipBack, SkipForward } from 'lucide-react';
import * as THREE from 'three';
import MapFullscreenFrame from '@/components/maps/MapFullscreenFrame';
import { loadGoogleMaps, subscribeToGoogleMapsAuthFailure } from './google-maps-loader';
import {
  createBusJourney,
  disposeMeshResources,
  getBearing,
  getDirectionStops,
  getRoutePoints,
  makeBus,
  type LngLatPoint,
  type RouteMap3DProps,
} from './route-map-journey';
import styles from './RouteMapGoogle3D.module.css';

const FOLLOW_ZOOM = 16.6;
const FOLLOW_TILT = 58;
const MAP_LOAD_TIMEOUT = 18_000;
const PREVIEW = process.env.NODE_ENV === 'development';
const MAP_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY?.trim();
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_3D_MAP_ID?.trim() || (PREVIEW ? 'DEMO_MAP_ID' : undefined);

type Props = RouteMap3DProps & {
  onUnavailable: (message: string) => void;
};

function toLatLng([lng, lat]: LngLatPoint) {
  return { lat, lng };
}

function createStopBadge(name: string) {
  const badge = document.createElement('div');
  badge.className = styles.stop;
  const label = document.createElement('span');
  label.className = styles.stopLabel;
  label.textContent = name;
  const icon = document.createElement('span');
  icon.className = styles.stopIcon;
  icon.setAttribute('aria-hidden', 'true');
  badge.append(label, icon);
  return badge;
}

export default function RouteMapGoogle3D({ duraklar, selectedDirection, path, onUnavailable }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fullRouteRef = useRef<(() => void) | null>(null);
  const followRef = useRef<(() => void) | null>(null);
  const playbackRef = useRef<{ toggle: () => void; step: (offset: -1 | 1) => void } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [following, setFollowing] = useState(true);
  const [paused, setPaused] = useState(false);
  const [stopNavigation, setStopNavigation] = useState({ previous: false, next: false });

  const stops = useMemo(() => getDirectionStops(duraklar, selectedDirection), [duraklar, selectedDirection]);
  const routePoints = useMemo(() => getRoutePoints(path, stops), [path, stops]);
  const approximate = path?.quality === 'approximate';

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    function notifyUnavailable(message: string) {
      queueMicrotask(() => {
        if (!cancelled) onUnavailable(message);
      });
    }

    if (!MAP_KEY || !MAP_ID || !stops.length || !routePoints.length) {
      notifyUnavailable(!MAP_KEY || !MAP_ID
        ? '3B harita şu anda kullanılamıyor.'
        : 'Bu yön için 3B haritada gösterilebilecek durak konumu bulunamadı.');
      return () => { cancelled = true; };
    }

    let failed = false;
    let teardown: (() => void) | undefined;

    function fail(message: string) {
      if (cancelled || failed) return;
      failed = true;
      window.clearTimeout(loadTimeout);
      notifyUnavailable(message);
    }

    queueMicrotask(() => {
      if (cancelled || failed) return;
      setLoaded(false);
      setFollowing(true);
    });

    const loadTimeout = window.setTimeout(() => {
      fail('3B harita zamanında açılamadı.');
    }, MAP_LOAD_TIMEOUT);
    const unsubscribeAuth = subscribeToGoogleMapsAuthFailure(() => {
      fail('3B haritaya şu anda erişilemiyor.');
    });

    void loadGoogleMaps(MAP_KEY).then(({ maps, marker }) => {
      if (cancelled || failed) return;

      const { sample: sampleJourney, stopArrivalTimes } = createBusJourney(stops, routePoints);
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const firstStop = stops[0];
      const initialHeading = getBearing(stops.slice(0, 3).map((stop) => [stop.XKOORDINATI, stop.YKOORDINATI]));
      const mapHost = document.createElement('div');
      mapHost.className = styles.mapHost;
      container.append(mapHost);
      teardown = () => mapHost.remove();
      const map = new maps.Map(mapHost, {
        mapId: MAP_ID,
        renderingType: maps.RenderingType.VECTOR,
        colorScheme: 'DARK',
        backgroundColor: '#151d2a',
        center: { lat: firstStop.YKOORDINATI, lng: firstStop.XKOORDINATI },
        zoom: FOLLOW_ZOOM,
        tilt: FOLLOW_TILT,
        heading: initialHeading,
        tiltInteractionEnabled: true,
        headingInteractionEnabled: true,
        gestureHandling: 'cooperative',
        disableDefaultUI: true,
        zoomControl: true,
        keyboardShortcuts: true,
      });
      const mapListeners: google.maps.MapsEventListener[] = [];
      const removeMapHost = () => {
        mapListeners.forEach((listener) => listener.remove());
        mapHost.remove();
      };
      teardown = removeMapHost;
      let tilesLoaded = false;
      let overlaysAttached = false;

      function attachJourney() {
        const bounds = new google.maps.LatLngBounds();
        routePoints.forEach((point) => bounds.extend(toLatLng(point)));
        stops.forEach((stop) => bounds.extend({ lat: stop.YKOORDINATI, lng: stop.XKOORDINATI }));
        const routeColor = selectedDirection === 'D' ? '#67e8f9' : '#86efac';
        const routeOptions: google.maps.PolylineOptions = {
          map,
          path: routePoints.map(toLatLng),
          clickable: false,
        };
        const routeOutline = approximate ? null : new maps.Polyline({
          ...routeOptions,
          strokeColor: '#09131f',
          strokeWeight: 9,
          strokeOpacity: 0.95,
        });
        const route = new maps.Polyline({
          ...routeOptions,
          strokeColor: routeColor,
          strokeWeight: 5,
          strokeOpacity: approximate ? 0 : 1,
          icons: approximate ? [{
            icon: { path: 'M 0,-1 0,1', strokeColor: routeColor, strokeOpacity: 1, strokeWeight: 4, scale: 2.5 },
            repeat: '14px',
          }] : undefined,
        });

        const infoWindow = new maps.InfoWindow({ disableAutoPan: true });
        const badges = stops.map((stop, index) => {
          const terminal = index === 0 || index === stops.length - 1;
          const title = `${stop.SIRANO}. ${stop.DURAKADI}`;
          const element = createStopBadge(title);
          if (terminal) element.dataset.terminal = 'true';
          const pin = new marker.AdvancedMarkerElement({
            map,
            position: { lat: stop.YKOORDINATI, lng: stop.XKOORDINATI },
            title,
            gmpClickable: true,
            collisionBehavior: terminal ? 'REQUIRED_AND_HIDES_OPTIONAL' : 'OPTIONAL_AND_HIDES_LOWER_PRIORITY',
            zIndex: terminal ? 2 : 1,
          });
          pin.append(element);
          const showInfo = () => {
            const content = document.createElement('div');
            const name = document.createElement('strong');
            name.textContent = title;
            const details = document.createElement('div');
            details.textContent = [stop.DURAKKODU, stop.ILCEADI].filter(Boolean).join(' · ');
            content.append(name, details);
            infoWindow.setContent(content);
            infoWindow.open({ map, anchor: pin });
          };
          pin.addEventListener('gmp-click', showInfo);
          return { element, pin, showInfo, terminal };
        });

        const bus = makeBus();
        bus.rotation.x = Math.PI / 2;
        bus.position.z = 4;
        const vehicle = new THREE.Group();
        vehicle.add(bus);
        vehicle.scale.setScalar(0.7);
        const scene = new THREE.Scene();
        scene.add(vehicle, new THREE.HemisphereLight(0xffffff, 0x475569, 2.2));
        const sunlight = new THREE.DirectionalLight(0xfff6da, 2.9);
        sunlight.position.set(8, -12, 20);
        scene.add(sunlight);
        const camera = new THREE.PerspectiveCamera();
        const overlay = new maps.WebGLOverlayView();
        let renderer: THREE.WebGLRenderer | undefined;
        let animationFrame = 0;
        let startTime: number | undefined;
        let elapsed = 0;
        let firstDraw = true;
        let activeIndex = -1;
        let isFollowing = true;
        let isPaused = reduceMotion || stops.length < 2;
        let lastCameraUpdate = 0;
        let heading = initialHeading;
        let position = sampleJourney(0);

        function showActiveStop(index: number) {
          if (index === activeIndex) return;
          const previous = badges[activeIndex];
          if (previous) {
            delete previous.element.dataset.active;
            previous.pin.collisionBehavior = previous.terminal ? 'REQUIRED_AND_HIDES_OPTIONAL' : 'OPTIONAL_AND_HIDES_LOWER_PRIORITY';
            previous.pin.zIndex = previous.terminal ? 2 : 1;
          }
          const active = badges[index];
          active.element.dataset.active = 'true';
          active.pin.collisionBehavior = 'REQUIRED_AND_HIDES_OPTIONAL';
          active.pin.zIndex = 3;
          activeIndex = index;
        }

        function getStepTarget(offset: -1 | 1) {
          // During travel, the highlighted stop is the one the bus is approaching.
          return offset === 1 && !position.atStop ? position.activeStopIndex : position.activeStopIndex + offset;
        }

        function updateStopNavigation() {
          setStopNavigation({ previous: getStepTarget(-1) >= 0, next: getStepTarget(1) < stops.length });
        }

        function updatePosition(next: typeof position) {
          const previous = position;
          position = next;
          if (next.activeStopIndex !== previous.activeStopIndex || next.atStop !== previous.atStop) {
            showActiveStop(next.activeStopIndex);
            updateStopNavigation();
          }
          return next.point[0] !== previous.point[0] || next.point[1] !== previous.point[1];
        }

        function animate(now: number) {
          if (cancelled || failed || isPaused) return;
          startTime ??= now - elapsed;
          elapsed = now - startTime;
          if (updatePosition(sampleJourney(elapsed))) {
            if (isFollowing && now - lastCameraUpdate >= 33) {
              map.moveCamera({ center: toLatLng(position.point) });
              lastCameraUpdate = now;
            }
            overlay.requestRedraw();
          }
          animationFrame = window.requestAnimationFrame(animate);
        }

        function setPlaybackPaused(nextPaused: boolean) {
          if (isPaused === nextPaused) return;
          isPaused = nextPaused;
          setPaused(nextPaused);
          if (nextPaused) {
            window.cancelAnimationFrame(animationFrame);
            startTime = undefined;
          } else {
            animationFrame = window.requestAnimationFrame(animate);
          }
        }

        function updateHeading() {
          const { point, nextPoint } = position;
          if (point[0] !== nextPoint[0] || point[1] !== nextPoint[1]) {
            heading = getBearing([point, nextPoint]);
          }
        }

        function focusBus() {
          isFollowing = true;
          setFollowing(true);
          updateHeading();
          map.moveCamera({ center: toLatLng(position.point), zoom: FOLLOW_ZOOM, tilt: FOLLOW_TILT, heading });
        }

        overlay.onAdd = () => { showActiveStop(0); };
        overlay.onContextRestored = ({ gl }) => {
          if (cancelled || failed) return;
          if (typeof WebGL2RenderingContext === 'undefined' || !(gl instanceof WebGL2RenderingContext)) {
            fail('3B harita bu cihazda açılamadı.');
            return;
          }
          try {
            renderer = new THREE.WebGLRenderer({ canvas: gl.canvas, context: gl });
            renderer.autoClear = false;
            overlay.requestRedraw();
          } catch {
            fail('3B haritanın grafikleri başlatılamadı.');
          }
        };
        overlay.onDraw = ({ transformer }) => {
          if (!renderer || failed || cancelled) return;
          const { point } = position;
          updateHeading();
          vehicle.rotation.z = THREE.MathUtils.degToRad(90 - heading);
          camera.projectionMatrix.fromArray(transformer.fromLatLngAltitude({ ...toLatLng(point), altitude: 1 }));
          renderer.resetState();
          try {
            renderer.render(scene, camera);
          } catch {
            fail('3B harita çizilemedi.');
            return;
          } finally {
            renderer.resetState();
          }
          if (firstDraw) {
            firstDraw = false;
            window.clearTimeout(loadTimeout);
            setPaused(isPaused);
            updateStopNavigation();
            setLoaded(true);
            if (!isPaused) animationFrame = window.requestAnimationFrame(animate);
          }
        };
        overlay.onContextLost = () => {
          renderer?.dispose();
          renderer = undefined;
        };
        const zoomListener = map.addListener('zoom_changed', () => {
          mapHost.dataset.overview = String((map.getZoom() ?? FOLLOW_ZOOM) < 12.3);
        });
        const dragListener = map.addListener('dragstart', () => {
          isFollowing = false;
          setFollowing(false);
        });
        fullRouteRef.current = () => {
          isFollowing = false;
          setFollowing(false);
          map.fitBounds(bounds, { top: 80, right: 50, bottom: 60, left: 50 });
        };
        followRef.current = focusBus;
        playbackRef.current = {
          toggle: () => setPlaybackPaused(!isPaused),
          step: (offset) => {
            const target = getStepTarget(offset);
            if (target < 0 || target >= stops.length) return;

            setPlaybackPaused(true);
            elapsed = stopArrivalTimes[target];
            updatePosition(sampleJourney(elapsed));
            focusBus();
            overlay.requestRedraw();
          },
        };
        teardown = () => {
          window.cancelAnimationFrame(animationFrame);
          zoomListener.remove();
          dragListener.remove();
          infoWindow.close();
          badges.forEach(({ pin, showInfo }) => {
            pin.removeEventListener('gmp-click', showInfo);
            pin.map = null;
          });
          route.setMap(null);
          routeOutline?.setMap(null);
          overlay.setMap(null);
          renderer?.dispose();
          disposeMeshResources(scene);
          fullRouteRef.current = null;
          followRef.current = null;
          playbackRef.current = null;
          removeMapHost();
          teardown = undefined;
        };
        overlay.setMap(map);
      }

      function attachWhenReady() {
        if (cancelled || failed || overlaysAttached || !tilesLoaded) return;
        const capabilities = map.getMapCapabilities();
        if (!capabilities.isWebGLOverlayViewAvailable || !capabilities.isAdvancedMarkersAvailable) return;
        overlaysAttached = true;
        try {
          attachJourney();
        } catch {
          fail('3B güzergâh katmanı başlatılamadı.');
        }
      }

      function checkRenderingType() {
        if (map.getRenderingType() === maps.RenderingType.RASTER) {
          fail('3B harita bu tarayıcıda açılamadı.');
        }
      }

      mapListeners.push(
        map.addListener('tilesloaded', () => {
          checkRenderingType();
          tilesLoaded = true;
          attachWhenReady();
        }),
        map.addListener('mapcapabilities_changed', attachWhenReady),
        map.addListener('renderingtype_changed', checkRenderingType),
      );
      checkRenderingType();
    }).catch(() => {
      fail('3B harita yüklenemedi.');
    });

    return () => {
      cancelled = true;
      window.clearTimeout(loadTimeout);
      unsubscribeAuth();
      teardown?.();
    };
  }, [approximate, onUnavailable, routePoints, selectedDirection, stops]);

  return (
    <MapFullscreenFrame className={styles.frame}>
      <div
        ref={containerRef}
        aria-label="3B güzergâh haritası"
        className={`map-fullscreen-canvas h-[350px] overflow-hidden rounded-xl md:h-[500px] ${styles.canvas}`}
      />
      {!loaded && (
        <div role="status" className={styles.status}>3B harita yükleniyor…</div>
      )}
      {loaded && (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.action}
            onClick={() => fullRouteRef.current?.()}
            aria-label="Tüm hattı göster"
          >
            <Route aria-hidden size={16} /> Tüm hat
          </button>
          <button
            type="button"
            className={styles.action}
            onClick={() => followRef.current?.()}
            aria-pressed={following}
          >
            <BusFront aria-hidden size={16} /> Otobüsü izle
          </button>
        </div>
      )}
      {loaded && stops.length > 1 && (
        <div className={styles.playback} role="group" aria-label="Otobüs animasyonu">
          <button
            type="button"
            className={styles.action}
            disabled={!stopNavigation.previous}
            onClick={() => playbackRef.current?.step(-1)}
            aria-label="Önceki durak"
          >
            <SkipBack aria-hidden size={16} />
            <span>Önceki<span className={styles.stopSuffix}> durak</span></span>
          </button>
          <button
            type="button"
            className={`${styles.action} ${styles.playbackToggle}`}
            onClick={() => playbackRef.current?.toggle()}
          >
            {paused ? <Play aria-hidden size={16} /> : <Pause aria-hidden size={16} />}
            {paused ? 'Devam et' : 'Duraklat'}
          </button>
          <button
            type="button"
            className={styles.action}
            disabled={!stopNavigation.next}
            onClick={() => playbackRef.current?.step(1)}
            aria-label="Sonraki durak"
          >
            <SkipForward aria-hidden size={16} />
            <span>Sonraki<span className={styles.stopSuffix}> durak</span></span>
          </button>
        </div>
      )}
      {loaded && approximate && <span className={styles.notice}>Yaklaşık güzergâh</span>}
    </MapFullscreenFrame>
  );
}
