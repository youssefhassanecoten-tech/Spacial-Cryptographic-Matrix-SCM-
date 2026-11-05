import { Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Grid, OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import { useStudio } from "../../store/useStudio";
import { AnchorMarkers } from "./AnchorMarkers";
import { BlockGrid } from "./BlockGrid";
import { ScanlineSheet } from "./ScanlineSheet";
import { TrajectoryLine } from "./TrajectoryLine";
import { VoxelField } from "./VoxelField";

function TimelineDriver() {
  const playing = useStudio((state) => state.playing);
  const speed = useStudio((state) => state.speed);
  const timeRef = useStudio((state) => state.timeRef);

  useFrame((_, delta) => {
    if (playing) {
      timeRef.current += Math.min(delta, 0.1) * speed;
    }
  });

  return null;
}

function SceneContent() {
  const matrix = useStudio((state) => state.matrix);
  const design = useStudio((state) => state.design);
  const layers = useStudio((state) => state.layers);
  const timeRef = useStudio((state) => state.timeRef);

  return (
    <>
      <TimelineDriver />
      <color attach="background" args={["#05070d"]} />
      <fog attach="fog" args={["#05070d", 28, 58]} />
      <ambientLight intensity={0.42} />
      <hemisphereLight args={["#22d3ee", "#0b1020", 0.55]} />
      <directionalLight
        position={[12, 18, 9]}
        intensity={2.1}
        color="#e0f2fe"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={45}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0004}
      />
      <pointLight position={[-11, 6, -8]} intensity={45} distance={34} color="#22d3ee" />
      <pointLight position={[10, -4, 9]} intensity={30} distance={30} color="#fb7185" />
      <pointLight position={[0, 10, 0]} intensity={22} distance={28} color="#a78bfa" />

      <group>
        <VoxelField matrix={matrix} design={design} layers={layers} timeRef={timeRef} />
        {design.showGrid ? <BlockGrid /> : null}
        {design.showAnchors ? <AnchorMarkers anchors={matrix.anchors} timeRef={timeRef} /> : null}
        {design.showTrajectory ? (
          <TrajectoryLine matrix={matrix} layers={layers} timeRef={timeRef} />
        ) : null}
        <ScanlineSheet layers={layers} timeRef={timeRef} />
      </group>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -4.98, 0]} receiveShadow>
        <planeGeometry args={[46, 46]} />
        <meshStandardMaterial color="#05070d" roughness={0.95} metalness={0.02} />
      </mesh>
      <Grid
        position={[0, -4.96, 0]}
        args={[42, 42]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1e293b"
        sectionSize={3}
        sectionThickness={0.9}
        sectionColor="#0e7490"
        fadeDistance={34}
        fadeStrength={1.4}
        infiniteGrid={false}
      />
      <ContactShadows
        position={[0, -4.94, 0]}
        opacity={0.42}
        scale={28}
        blur={2.6}
        far={7}
        resolution={512}
        color="#000000"
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.075}
        minDistance={9}
        maxDistance={38}
        minPolarAngle={0.22}
        maxPolarAngle={Math.PI - 0.22}
        enablePan={false}
        autoRotate={design.autoRotate}
        autoRotateSpeed={0.72}
      />
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.7}
          luminanceThreshold={0.32}
          luminanceSmoothing={0.18}
          mipmapBlur
          radius={0.68}
        />
      </EffectComposer>
    </>
  );
}

export function Scene() {
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.75]}
      camera={{ position: [13.5, 11, 15.5], fov: 42, near: 0.1, far: 100 }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.08,
      }}
    >
      <Suspense fallback={null}>
        <SceneContent />
      </Suspense>
    </Canvas>
  );
}
