"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { GlobeMethods, GlobeProps } from "react-globe.gl";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import type { CountryMatches } from "@/types/football";
import { useI18n } from "@/i18n/I18nProvider";

const Globe = dynamic<GlobeProps>(() => import("react-globe.gl"), { ssr: false }) as unknown as ForwardRefExoticComponent<
  GlobeProps & RefAttributes<GlobeMethods>
>;

interface CountryFeature extends Feature<Geometry> {
  properties: { name?: string } | null;
}

interface FootballGlobeProps {
  countries: CountryMatches[];
  selectedCode?: string;
  onSelect: (country: CountryMatches) => void;
}

const topology = world as unknown as Topology<{ countries: GeometryCollection }>;
const countryPolygons = (feature(topology, topology.objects.countries) as FeatureCollection<Geometry>).features as CountryFeature[];
let sharedBallMaterial: THREE.SpriteMaterial | null = null;

function getBallMaterial() {
  if (sharedBallMaterial) return sharedBallMaterial;
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("CANVAS_UNAVAILABLE");

  context.clearRect(0, 0, 96, 96);
  context.beginPath();
  context.arc(48, 48, 34, 0, Math.PI * 2);
  context.fillStyle = "#ffffff";
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = "#15181b";
  context.stroke();

  const pentagon = (cx: number, cy: number, radius: number, rotation = -Math.PI / 2) => {
    context.beginPath();
    for (let index = 0; index < 5; index += 1) {
      const angle = rotation + index * Math.PI * 2 / 5;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.closePath();
    context.fillStyle = "#16191c";
    context.fill();
  };

  pentagon(48, 48, 10);
  const patches = [
    [48, 21, 7, Math.PI / 2],
    [73, 39, 7, Math.PI],
    [63, 70, 7, -Math.PI / 4],
    [33, 70, 7, Math.PI / 4],
    [23, 39, 7, 0],
  ] as const;
  for (const [x, y, radius, rotation] of patches) pentagon(x, y, radius, rotation);

  context.strokeStyle = "rgba(20,23,26,.72)";
  context.lineWidth = 2;
  const links = [
    [48, 39, 48, 28], [56, 44, 67, 40], [54, 56, 61, 65], [42, 56, 35, 65], [40, 44, 29, 40],
  ];
  for (const [x1, y1, x2, y2] of links) {
    context.beginPath(); context.moveTo(x1, y1); context.lineTo(x2, y2); context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  sharedBallMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false });
  return sharedBallMaterial;
}

export function FootballGlobe({ countries, selectedCode, onSelect }: FootballGlobeProps) {
  const { plural, t } = useI18n();
  const globeRef = useRef<GlobeMethods | null>(null);
  const resizeFrame = useRef<number | null>(null);
  const restoreQualityTimer = useRef<number | null>(null);
  const controlsCleanup = useRef<(() => void) | null>(null);
  const markerCache = useRef(new Map<string, THREE.Sprite>());
  const [size, setSize] = useState({ width: 900, height: 700 });
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);
  const mobileQuality = size.width <= 720;
  const byGlobeName = useMemo(() => new Map(countries.map((country) => [country.globeName, country])), [countries]);
  const activePolygons = useMemo(() => countryPolygons.filter((polygon) => byGlobeName.has(polygon.properties?.name ?? "")), [byGlobeName]);
  const rendererConfig = useMemo(() => ({ antialias: !mobileQuality, alpha: true, powerPreference: "high-performance" as const }), [mobileQuality]);

  useEffect(() => {
    const update = () => {
      if (resizeFrame.current !== null) return;
      resizeFrame.current = window.requestAnimationFrame(() => {
        resizeFrame.current = null;
        const mobile = window.innerWidth < 640;
        setSize((current) => {
          const next = { width: window.innerWidth, height: Math.max(420, window.innerHeight - (mobile ? 164 : 90)) };
          return current.width === next.width && current.height === next.height ? current : next;
        });
      });
    };
    const frame = window.requestAnimationFrame(() => {
      try {
        const canvas = document.createElement("canvas");
        setWebglAvailable(Boolean(canvas.getContext("webgl2", { powerPreference: "high-performance" }) || canvas.getContext("webgl")));
      } catch {
        setWebglAvailable(false);
      }
      update();
    });
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("orientationchange", update, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      if (resizeFrame.current !== null) window.cancelAnimationFrame(resizeFrame.current);
      if (restoreQualityTimer.current !== null) window.clearTimeout(restoreQualityTimer.current);
      controlsCleanup.current?.();
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  useEffect(() => {
    const activeCodes = new Set(countries.map((country) => country.countryCode));
    for (const code of markerCache.current.keys()) {
      if (!activeCodes.has(code)) markerCache.current.delete(code);
    }
  }, [countries]);

  useEffect(() => {
    if (!selectedCode || !globeRef.current) return;
    const country = countries.find((item) => item.countryCode === selectedCode);
    if (country) globeRef.current.pointOfView({ lat: country.lat, lng: country.lng, altitude: 1.62 }, 260);
  }, [countries, selectedCode]);

  useEffect(() => {
    const visibility = () => {
      const globe = globeRef.current;
      if (!globe) return;
      if (document.hidden) globe.pauseAnimation(); else globe.resumeAnimation();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);

  const handleReady = useCallback(() => {
    const globe = globeRef.current;
    const controls = globe?.controls();
    const renderer = globe?.renderer();
    if (!controls || !renderer) return;
    controlsCleanup.current?.();

    const mobile = window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 720;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const idleRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.18 : 1.55);
    const dragRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.25);

    renderer.setPixelRatio(idleRatio);
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 0.2;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = mobile ? 0.3 : 0.22;
    controls.rotateSpeed = mobile ? 1.8 : 1.5;
    controls.zoomSpeed = mobile ? 1.25 : 1.1;
    controls.minDistance = 130;
    controls.maxDistance = 360;

    const onStart = () => {
      if (restoreQualityTimer.current !== null) window.clearTimeout(restoreQualityTimer.current);
      renderer.setPixelRatio(dragRatio);
      controls.autoRotate = false;
    };
    const onEnd = () => {
      if (restoreQualityTimer.current !== null) window.clearTimeout(restoreQualityTimer.current);
      restoreQualityTimer.current = window.setTimeout(() => {
        renderer.setPixelRatio(idleRatio);
        controls.autoRotate = !reduceMotion;
      }, 220);
    };
    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);
    controlsCleanup.current = () => {
      controls.removeEventListener("start", onStart);
      controls.removeEventListener("end", onEnd);
    };
  }, []);

  const polygonCountry = useCallback((item: object) => byGlobeName.get((item as CountryFeature).properties?.name ?? ""), [byGlobeName]);
  const polygonCapColor = useCallback((item: object) => polygonCountry(item)?.countryCode === selectedCode ? "rgba(83,157,201,0.12)" : "rgba(147,190,214,0.008)", [polygonCountry, selectedCode]);
  const polygonStrokeColor = useCallback((item: object) => polygonCountry(item)?.countryCode === selectedCode ? "rgba(199,232,248,0.9)" : "rgba(170,205,224,0.20)", [polygonCountry, selectedCode]);
  const polygonAltitude = useCallback((item: object) => polygonCountry(item)?.countryCode === selectedCode ? 0.004 : 0.001, [polygonCountry, selectedCode]);
  const countryLabel = useCallback((item: object) => {
    const country = item as CountryMatches;
    const flag = /^[A-Z]{2}$/.test(country.countryCode) ? `<img src="https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.5.0/flags/4x3/${country.countryCode.toLowerCase()}.svg" width="18" height="13" style="vertical-align:-2px;border-radius:2px;margin-right:5px" alt="">` : "";
    return `<b>${flag}${country.country}</b><br/>${plural("matches", country.matches.length)}`;
  }, [plural]);
  const polygonLabel = useCallback((item: object) => {
    const country = polygonCountry(item);
    return country ? countryLabel(country) : "";
  }, [countryLabel, polygonCountry]);
  const onPolygonClick = useCallback((item: object) => {
    const country = polygonCountry(item);
    if (country) onSelect(country);
  }, [onSelect, polygonCountry]);
  const onMarkerClick = useCallback((item: object) => onSelect(item as CountryMatches), [onSelect]);
  const markerObject = useCallback((item: object) => {
    const country = item as CountryMatches;
    let sprite = markerCache.current.get(country.countryCode);
    if (!sprite) {
      sprite = new THREE.Sprite(getBallMaterial());
      sprite.center.set(0.5, 0.5);
      sprite.renderOrder = 4;
      sprite.scale.set(7.1, 7.1, 1);
      markerCache.current.set(country.countryCode, sprite);
    }
    return sprite;
  }, []);

  useEffect(() => {
    for (const country of countries) {
      const sprite = markerCache.current.get(country.countryCode);
      if (!sprite) continue;
      const scale = country.countryCode === selectedCode ? 8.2 : 7.1;
      sprite.scale.set(scale, scale, 1);
    }
  }, [countries, selectedCode]);

  if (webglAvailable === null) return <div className="globe-stage" aria-busy="true" />;
  if (!webglAvailable) return (
    <div className="globe-stage globe-unavailable" role="status">
      <Globe2Fallback />
      <strong>{t("globeUnavailable")}</strong>
      <p>{t("globeFallback")}</p>
    </div>
  );

  return (
    <div className="globe-stage" aria-label={t("globeAria")}>
      <Globe
        ref={globeRef}
        width={size.width}
        height={size.height}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="/earth-day.jpg"
        globeCurvatureResolution={mobileQuality ? 5 : 4}
        showAtmosphere
        atmosphereColor="#6ca6c8"
        atmosphereAltitude={0.12}
        showGraticules={false}
        polygonsData={activePolygons}
        polygonCapColor={polygonCapColor}
        polygonSideColor={() => "rgba(0,0,0,0)"}
        polygonStrokeColor={polygonStrokeColor}
        polygonAltitude={polygonAltitude}
        polygonCapCurvatureResolution={mobileQuality ? 12 : 9}
        polygonLabel={polygonLabel}
        onPolygonClick={onPolygonClick}
        polygonsTransitionDuration={0}
        objectsData={countries}
        objectLat="lat"
        objectLng="lng"
        objectAltitude={0.035}
        objectFacesSurfaces={false}
        objectThreeObject={markerObject}
        objectLabel={countryLabel}
        onObjectClick={onMarkerClick}
        rendererConfig={rendererConfig}
        onGlobeReady={handleReady}
      />
      <div className="globe-hint" aria-hidden="true">
        <span className="mouse-mark" /> {t("dragExplore")} <span className="hint-separator">•</span> {t("zoomHint")}
      </div>
    </div>
  );
}

function Globe2Fallback() {
  return <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><circle cx="32" cy="32" r="25" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M7 32h50M32 7c9 8 13 16 13 25S41 49 32 57M32 7c-9 8-13 16-13 25s4 17 13 25M12 19h40M12 45h40" fill="none" stroke="currentColor" strokeWidth="1" opacity=".65"/></svg>;
}
