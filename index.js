import * as THREE from 'three';
import metaversefile from 'metaversefile';
const {useApp, useFrame, useCleanup, useGeometries, useMaterials, usePhysics, useProcGen} = metaversefile;

// const chunkSize = 30;
const numPoints = 4096;
// const stepRange = 10;
const stepSize = 4;
const directionStepRange = 0.1 * Math.PI;
const directionStepLimit = 0.05;

export default () => {
  const app = useApp();
  const {StreetFlatGeometry} = useGeometries();
  const {WebaverseShaderMaterial} = useMaterials();
  const procGen = useProcGen();
  const physicsManager = usePhysics();
  const {alea} = procGen;

  // const streetSize = new THREE.Vector3(10, 1, 1000);
  const startPoint = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3(0, 0, -1);

  const streetMesh = (() => {
    const material = new WebaverseShaderMaterial({
      uniforms: {
        uTime: {
          type: 'f',
          value: 0,
        },
        /* uBeat: {
          type: 'f',
          value: 1,
        }, */
      },
      vertexShader: `\
        attribute float y;
        attribute vec3 barycentric;
        varying float vUv;
        varying vec3 vBarycentric;
        varying vec3 vPosition;
        void main() {
          vUv = uv.x;
          vBarycentric = barycentric;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `\
        // uniform float uBeat;
        varying vec3 vBarycentric;
        varying vec3 vPosition;
        uniform float uTime;

        struct C{
            float d;
            int t;
        };
            
        float rand2(vec2 co){
            return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
        }

        float rand(vec3 v){
            return rand2(vec2(v.x+v.z,v.y+v.z));
        }

        int wait(float t){
            float period = 4.*3.141592/1.5;
            t = mod(t,period);
            if(t < period/2.){
                if(t < period/8.)return 0;
                if(t < period/4.)return 1;
                return int((t/period-1./4.)*40.)+2;
            }else{
                t-=period/2.;
                if(t < period/8.)return 10;
                if(t < period/4.)return 9;
                return 8-int((t/period-1./4.)*40.);
            }
            return 0;
        }

        float scal(float t){
            float period = 4.*3.141592/1.5;
            t = mod(t,period);
            float base = -1000.0;
            if(t < period/2.){
                if(t < period/8.)base=-1000.0;
                else if(t < period/4.)base=period/8.;
                else if(t<period*(1./4.+9./40.)){
                    int x = int((t/period-1./4.)*40.);
                  base = period*(1./4.+float(x)/40.);
                }
            }else{
                t -= period/2.;
                if(t < period/8.)base=-1000.0;
                else if(t < period/4.)base=period/8.;
                else if(t<period*(1./4.+9./40.)){
                    int x = int((t/period-1./4.)*40.);
                  base = period*(1./4.+float(x)/40.);
                }
            }
            return exp(-(t-base)*10.);
        }

        vec3 transform(vec3 p){
            float t = uTime+sin(uTime*1.5);
            p -= vec3(4,0,0);
            p *= mat3(cos(t),0,sin(t),0,1,0,-sin(t),0,cos(t));
            t *= 1.2;
            t += sin(uTime*0.5);
            p *= mat3(cos(t),sin(t),0,-sin(t),cos(t),0,0,0,1);
            return p;
        }

        float pattern(vec3 p, float section) {
          // p = transform(p);
          /* float s = 1.; // (0.7+scal(uTime)*0.08) / 0.7;
          p /= s;
          p /= 1.3;
          p += 0.5; */
          float d = 0.;
          // float t = uTime;
          vec3 e = vec3(section);
          for(int i=0;i<10;i++){
              // if(wait(t) <= i)break;
              float w = pow(2.,float(i));
              float f;

              f = rand(vec3(0,0,float(i))+e);
              if(p.x < f)e.x+=w;
              else e.x-=w;
              if(pow(max(0.,1.-abs(p.x-f)),90.)*1.5 > 0.5+float(i)/20.)d = 1.;

              f = rand(vec3(1,0,float(i))+e);
              if(p.y < f)e.y+=w;
              else e.y-=w;
              if(pow(max(0.,1.-abs(p.y-f)),90.)*1.5 > 0.5+float(i)/20.)d = 1.;

              f = rand(vec3(2,0,float(i))+e);
              if(p.z < f)e.z+=w;
              else e.z-=w;
              if(pow(max(0.,1.-abs(p.z-f)),90.)*1.5 > 0.5+float(i)/20.)d = 1.;
          }
          return d<1.?0.:1.;
        }

        const vec3 lineColor1 = vec3(${new THREE.Color(0x4fc3f7).toArray().join(', ')});
        // const vec3 lineColor2 = vec3(${new THREE.Color(0x9575cd).toArray().join(', ')});

        void main() {
          // vec3 c = mix(lineColor1, lineColor2, vPosition.y / 10.);
          vec3 c = lineColor1;
          vec3 p = mod(vec3(vPosition.x*0.99, vPosition.y, vPosition.z)/10. + 0.5, 1.);
          float section = floor(vPosition.z/10.);
          float f = pattern(p, section);
          gl_FragColor = vec4(c * (f > 0.5 ? 1. : 0.2) /* * uBeat */, 1.);
          gl_FragColor = sRGBToLinear(gl_FragColor);
        }
      `,
      side: THREE.DoubleSide,

      clipping: false,
      fog: false,
      lights: false,
    });
    
    // point
    const rng = alea('path');
    const r = () => -1 + 2 * rng();
    const splinePoints = Array(numPoints + 1);
    const position = startPoint.clone();
    for (let i = 0; i <= numPoints; i++) {
      const p = position.clone();
      position.add(
        direction.clone()
          .multiplyScalar(stepSize)
      );
      position.y = Math.max(position.y, 0);
      direction.x += r() * directionStepRange;
      direction.x *= 0.9;
      direction.y += r() * directionStepRange;
      direction.y = Math.min(Math.max(direction.y, -directionStepLimit), directionStepLimit);
      direction.normalize();

      // console.log('curve', position.toArray().join(','), direction.toArray().join(','));

      splinePoints[i] = p;
    }
    const curve = new THREE.CatmullRomCurve3(splinePoints);

    const geometry = new StreetFlatGeometry(
      curve,
      numPoints,
      4, // radiusX
      0.05, // radiusY
      4, // radialSegments
      false // closed
    );
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  })();
  streetMesh.position.set(0, -1/2, 0);
  app.add(streetMesh);
  streetMesh.updateMatrixWorld();
  
  // streetMesh.position.x = chunkSize/2;
  // streetMesh.position.z = chunkSize/2;
  // streetMesh.updateMatrixWorld();
  
  const physics = usePhysics();
  /* const floorPhysicsId = physics.addBoxGeometry(
    new THREE.Vector3(0, -streetSize.y/2, 0)
      .applyQuaternion(streetMesh.quaternion),
    streetMesh.quaternion,
    new THREE.Vector3(streetSize.x, streetSize.y, streetSize.z).multiplyScalar(0.5),
    false
  ); */
  const streetPhysicsId = physics.addGeometry(streetMesh);
  useFrame(({timestamp}) => {
    // streetMesh.material.uniforms.uTime.value = (timestamp % 10000) / 20;
  });
  
  useCleanup(() => {
    physicsManager.removeGeometry(streetPhysicsId);
  });

  return app;
}