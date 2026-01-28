import * as THREE from './lib/three/three.module.js';
import { PDBLoader } from './lib/three/examples/jsm/loaders/PDBLoader.js';

class SimpleViewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.proteinGroup = null;
    this.scrollRotation = 0;

    this.init();
    this.loadProtein();
    this.animate();
  }

  init() {
    // Get canvas dimensions
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    // Camera - positioned similar to original repo
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000);
    this.camera.position.set(0, 50, 120);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: this.canvas,
      antialias: true,
      precision: 'highp'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(100, 100, 100);
    this.scene.add(directionalLight);

    // Create protein group
    this.proteinGroup = new THREE.Group();
    this.scene.add(this.proteinGroup);

    // Handle window resize
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });

    // Handle scroll
    window.addEventListener('scroll', () => {
      this.scrollRotation = window.scrollY * 0.001;
    });
  }

  loadProtein() {
    const loader = new PDBLoader();
    loader.load(
      './assets/8X48.pdb',
      (pdb) => this.onProteinLoaded(pdb),
      (xhr) => {
        const percent = (xhr.loaded / xhr.total * 100).toFixed(1);
        console.log(`Loading protein: ${percent}%`);
      },
      (error) => console.error('Error loading protein:', error)
    );
  }

  onProteinLoaded(pdb) {
    const geometryAtoms = pdb.geometryAtoms;
    const json = pdb.json;

    // Center the protein
    geometryAtoms.computeBoundingBox();
    const offset = new THREE.Vector3();
    geometryAtoms.boundingBox.getCenter(offset).negate();
    geometryAtoms.translate(offset.x, offset.y, offset.z);

    // Render atoms with instanced mesh (20% rejection for performance)
    this.renderAtomsInstanced(geometryAtoms);
    
    console.log(`Protein loaded: ${json.atoms.length} atoms`);
  }

  renderAtomsInstanced(geometryAtoms) {
    const positions = geometryAtoms.getAttribute('position');
    const colors = geometryAtoms.getAttribute('color');
    const totalAtoms = positions.count;
    const rejectionRate = 0.6; // Skip 60% of atoms for performance
    const renderedAtoms = Math.floor(totalAtoms * (1 - rejectionRate));

    // Use IcosahedronGeometry for atoms
    const atomGeometry = new THREE.IcosahedronGeometry(1, 1);
    const atomMaterial = new THREE.MeshPhongMaterial({
      shininess: 100,
      emissive: 0x111111
    });
    
    const atomsMesh = new THREE.InstancedMesh(
      atomGeometry,
      atomMaterial,
      renderedAtoms
    );

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3(50, 50, 50);  // Larger atom scale
    const quaternion = new THREE.Quaternion();
    const color = new THREE.Color();

    let instanceIndex = 0;
    const skipInterval = Math.round(1 / (1 - rejectionRate));
    
    for (let i = 0; i < totalAtoms && instanceIndex < renderedAtoms; i++) {
      if (i % skipInterval !== 0) continue;

      position.set(
        positions.getX(i) * 75,
        positions.getY(i) * 75,
        positions.getZ(i) * 75
      );

      matrix.compose(position, quaternion, scale);
      atomsMesh.setMatrixAt(instanceIndex, matrix);

      color.setRGB(
        Math.max(0.3, colors.getX(i)),
        Math.max(0.3, colors.getY(i)),
        Math.max(0.3, colors.getZ(i))
      );
      atomsMesh.setColorAt(instanceIndex, color);

      instanceIndex++;
    }

    atomsMesh.instanceMatrix.needsUpdate = true;
    atomsMesh.instanceColor.needsUpdate = true;

    // Position and scale protein group
    this.proteinGroup.add(atomsMesh);
    this.proteinGroup.scale.set(0.006, 0.006, 0.006);
    this.proteinGroup.rotation.x = -Math.PI / 2;
    this.proteinGroup.position.set(0, 30, 0);
    
    console.log(`Rendered ${instanceIndex} atoms using InstancedMesh (${totalAtoms} total)`);
  }

  animate = () => {
    requestAnimationFrame(this.animate);
    
    // Rotate protein based on scroll on X and Z axes
    this.proteinGroup.rotation.x += (this.scrollRotation - this.proteinGroup.rotation.x) * 0.1;
    this.proteinGroup.rotation.z += (this.scrollRotation * 0.5 - this.proteinGroup.rotation.z) * 0.1;
    
    this.renderer.render(this.scene, this.camera);
  }
}

export default SimpleViewer;
