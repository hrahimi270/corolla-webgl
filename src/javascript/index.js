import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import Sizes from './Utils/Sizes.js'
import Time from './Utils/Time.js'

global.THREE = THREE;

class WebGL {
    constructor() {
        this.$canvas = document.getElementsByClassName("canvas")[0];
        this.sizes = new Sizes();
        this.time = new Time();
        this.lights = [];

        this.setEnvironment();
    }
    setEnvironment() {
        // Scene
        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color( 0xa0a0a0 );

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas: this.$canvas })
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.renderer.setSize(this.sizes.viewport.width, this.sizes.viewport.height)

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            0.8 * 180 / Math.PI,
            this.sizes.viewport.width /
            this.sizes.viewport.height,
            0.01,
            1000,
        );
        this.scene.add(this.camera)

        // OrbitControl
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enabled = true;

        // Background
        this.scene.background =  new THREE.CubeTextureLoader()
        .setPath("environment/")
        .load([
            'px.jpg',
            'nx.jpg',
            'py.jpg',
            'ny.jpg',
            'pz.jpg',
            'nz.jpg'
        ])

        // Load GLTF
        this.initialGLTF()

        // Add Lights
        this.setLights();

        // Time tick
        this.time.on('tick', () => {
            // Renderer
            this.renderer.render(this.scene, this.camera)
            this.controls.update();
        })

        // Resize
        this.sizes.on('resize', () => {
            this.camera.aspect = this.sizes.viewport.width / this.sizes.viewport.height
            this.camera.updateProjectionMatrix()

            this.renderer.setSize(this.sizes.viewport.width, this.sizes.viewport.height);
        })
    }
    initialGLTF() {
        // Draco
        const dracoLoader = new DRACOLoader()
        dracoLoader.setDecoderPath('draco/')
        dracoLoader.setDecoderConfig({ type: 'js' })

        // GLTF
        const gltfLoader = new GLTFLoader()
        gltfLoader.setDRACOLoader(dracoLoader)

        gltfLoader.load("corolla_draco.gltf", (gltf) => {
            var object = gltf.scene;

            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3()).length();
            const center = box.getCenter(new THREE.Vector3());

            // reset OrbitControl
            this.controls.reset();

            object.position.x += (object.position.x - center.x);
            object.position.y += (object.position.y - center.y);
            object.position.z += (object.position.z - center.z);

            this.controls.maxDistance = size * 10;

            this.camera.near = size / 100;
            this.camera.far = size * 100;

            this.camera.position.copy(center);
            this.camera.position.x += size / 2.0;
            this.camera.position.y += size / 5.0;
            this.camera.position.z += size / 2.0;
            this.camera.lookAt(center);

            this.gltf = object;
            this.scene.add(this.gltf);
        },
            this.manageLoading,
            this.gltfLoadErr);
    }
    manageLoading(xhr) {
        console.log(Math.round(xhr.loaded / xhr.total * 100) + '% loaded');
    }
    gltfLoadErr(err) {
        console.error('An error happened: ', err);
    }
    setLights() {
        const light1 = new THREE.AmbientLight(0xFFFFFF, 0.3);
        light1.name = 'ambient_light';
        this.camera.add(light1);

        const light2 = new THREE.DirectionalLight(0xFFFFFF, 0.8 * Math.PI);
        light2.position.set(0.5, 0, 0.866);
        light2.name = 'main_light';
        this.camera.add(light2);
    }
}

window.application = new WebGL();