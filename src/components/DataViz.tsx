import { useRef, useMemo, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

// DataPoint component optimized with memo
const DataPoint = memo(({ position, color = "#34d399" }: { position: [number, number, number], color?: string }) => {
  // Memoize geometry and material
  const geometry = useMemo(() => new THREE.SphereGeometry(0.05, 8, 8), []); // Reduced segments from 16 to 8
  const material = useMemo(() => new THREE.MeshPhongMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.5
  }), [color]);

  return <mesh position={position} geometry={geometry} material={material} />;
});

// DataRing component optimized with memo
const DataRing = memo(({ index, opacity }: { index: number, opacity: number }) => {
  // Memoize geometry and material
  const geometry = useMemo(() => new THREE.TorusGeometry(2 + index * 0.3, 0.02, 8, 50), [index]); // Reduced segments
  
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <primitive object={geometry} />
      <MeshDistortMaterial
        color="#34d399"
        speed={2}
        distort={0.3}
        radius={1}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
});

function DataViz() {
  const ringsRef = useRef<THREE.Group>(null);
  
  // Pre-compute data points positions
  const dataPoints = useMemo(() => {
    return [...Array(15)].map((_, i) => { // Reduced from 20 to 15 points
      const angle = (i / 15) * Math.PI * 2;
      const radius = 2;
      return {
        id: `point-${i}`,
        position: [
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          0
        ] as [number, number, number]
      };
    });
  }, []);

  // Pre-compute ring properties
  const rings = useMemo(() => {
    return [...Array(3)].map((_, i) => ({
      index: i,
      opacity: 0.6 - i * 0.1
    }));
  }, []);

  useFrame(({ clock }) => {
    if (ringsRef.current) {
      ringsRef.current.rotation.z = clock.getElapsedTime() * 0.1;
    }
  });

  return (
    <group ref={ringsRef}>
      {/* Data Flow Rings - now using memoized component */}
      {rings.map((ring) => (
        <DataRing key={`ring-${ring.index}`} index={ring.index} opacity={ring.opacity} />
      ))}

      {/* Data Points - now using memoized component */}
      {dataPoints.map((point) => (
        <DataPoint key={point.id} position={point.position} />
      ))}
    </group>
  );
}

export default memo(DataViz);