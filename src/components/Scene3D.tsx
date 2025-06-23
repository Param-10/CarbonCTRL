import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Float, Preload } from '@react-three/drei';
import Earth3D from './Earth3D';
import DataViz from './DataViz';

export default function Scene3D() {
  const dpr = 1.5;
  
  return (
    <div className="absolute inset-0 -z-10 opacity-90">
      <Canvas camera={{ position: [0, 0, 5], fov: 60 }} dpr={dpr}>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={60} />
        <ambientLight intensity={0.8} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#34d399" />
        <spotLight
          position={[-10, 0, 0]}
          angle={0.3}
          penumbra={1}
          intensity={0.8}
          castShadow
          color="#34d399"
        />
        
        {/* Lighting effects */}

        {/* Main Earth component with floating animation */}
        <Float
          speed={2}
          rotationIntensity={0.5}
          floatIntensity={0.5}
        >
          <Earth3D />
        </Float>

        {/* Data visualization rings */}
        <DataViz />

        {/* Enhanced controls */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.5}
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={Math.PI / 2}
          dampingFactor={0.05}
          rotateSpeed={0.5}
        />

        {/* Enhanced atmosphere */}
        <fog attach="fog" args={['#0f172a', 5, 15]} />
        
        {/* Preload assets for better performance */}
        <Preload all />
      </Canvas>
    </div>
  );
}
