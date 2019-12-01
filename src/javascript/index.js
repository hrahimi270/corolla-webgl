// THREE
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

// Classes
require('./Utils/Stats');

// Constants
global.THREE = THREE;
const DEFAULT_CAMERA = '[default]';

class WebGL {
    constructor(_options) {
        // variables
        this.$canvas = _options.canvas;
        this.lights = [];
        this.content = null;
        this.mixer = null;
        this.wheels = [];

        // state
        this.state = {
            camera: DEFAULT_CAMERA,
            carLoaded: false,
            wheelsCanRotate: false,
            wheelSpeed: 0.1,

            // Lights
            addLights: true,
            exposure: 1.0,
            textureEncoding: 'sRGB',
            ambientIntensity: 0.3,
            ambientColor: 0xFFFFFF,
            directIntensity: 0.8 * Math.PI, // TODO(#116)
            directColor: 0xFFFFFF,
        };

        this.prevTime = 0;

        // Scene
        this.scene = new THREE.Scene();

        // Camera
        const fov = 60;
        this.defaultCamera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.01, 1000);
        this.activeCamera = this.defaultCamera;
        this.scene.add(this.defaultCamera);

        // Renderer
        this.renderer = window.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: this.$canvas });
        this.renderer.physicallyCorrectLights = true;
        this.renderer.gammaOutput = true;
        this.renderer.gammaFactor = 2.2;
        this.renderer.setClearColor(0xcccccc);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // Controls
        this.controls = new OrbitControls(this.defaultCamera, this.renderer.domElement);
        this.controls.autoRotate = false;
        this.controls.autoRotateSpeed = -10;
        this.controls.screenSpacePanning = true;

        // Background
        this.background = new THREE.CubeTextureLoader()
            .setPath("environment/envSky/")
            .load([
                'px.jpg',
                'nx.jpg',
                'py.jpg',
                'ny.jpg',
                'pz.jpg',
                'nz.jpg'
            ]);
        this.scene.background = this.background;

        // Animate
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);

        // Resize listener
        window.addEventListener('resize', this.resize.bind(this), false);

        // Start Loading
        this.load();
    }
    animate(time) {
        requestAnimationFrame(this.animate);

        const dt = (time - this.prevTime) / 1000;
        this.controls.update();
        this.mixer && this.mixer.update(dt);
        this.render();

        if (this.state.carLoaded && this.wheels.length === 4) {
            this.rotateWheels(this.wheels[0]);
            this.rotateWheels(this.wheels[1]);
            this.rotateWheels(this.wheels[2]);
            this.rotateWheels(this.wheels[3]);
        }

        this.prevTime = time;
    }
    render() {
        this.renderer.render(this.scene, this.activeCamera);
    }
    resize() {

        const width = window.innerWidth, height = window.innerHeight;

        this.defaultCamera.aspect = width / height;
        this.defaultCamera.updateProjectionMatrix();
        this.renderer.setSize(width, height);

    }
    load() {

        // Draco
        const dracoLoader = new DRACOLoader()
        dracoLoader.setDecoderPath('draco/')
        dracoLoader.setDecoderConfig({ type: 'js' })

        // GLTF
        const gltfLoader = new GLTFLoader()
        gltfLoader.setDRACOLoader(dracoLoader)
        gltfLoader.setCrossOrigin('anonymous')

        const file = "corolla_draco.gltf";
        gltfLoader.load(file, (gltf) => {

            const scene = gltf.scene || gltf.scenes[0];
            this.setContent(scene);

        }, undefined, (error) => {
            console.error("Error: ", error)
        });

    }
    setContent(object) {
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3()).length();
        const center = box.getCenter(new THREE.Vector3());

        this.controls.reset();

        // object.position.x += (object.position.x - center.x);
        object.position.x = 0;
        object.position.y += (object.position.y - center.y);
        object.position.z += (object.position.z - center.z);

        this.controls.minDistance = size / 1.5;
        this.controls.maxDistance = size * 1.5;
        this.controls.maxPolarAngle = 0.9 * Math.PI / 2;

        this.defaultCamera.near = size / 100;
        this.defaultCamera.far = size * 100;
        this.defaultCamera.updateProjectionMatrix();

        this.defaultCamera.position.copy(center);
        this.defaultCamera.position.x += size / 2.0;
        this.defaultCamera.position.y += size / 5.0;
        this.defaultCamera.position.z += size / 2.0;
        this.defaultCamera.lookAt(center);

        this.setCamera(DEFAULT_CAMERA);

        this.controls.saveState();

        this.scene.add(object);
        this.content = object;

        this.state.addLights = true;
        this.content.traverse((node) => {
            if (node.isLight) {
                this.state.addLights = false;
            }
        });

        this.updateLights();
        this.updateEnvironment();
        this.updateTextureEncoding();

        // set car objects
        this.state.carLoaded = true;
        this.state.wheelsCanRotate = true;
        this.setCarObjects();

        window.content = this.content;
        console.info('[glTF Loader] THREE.Scene exported as `window.content`.');
        // this.printGraph(this.content);

    }
    setCamera(name) {
        if (name === DEFAULT_CAMERA) {
            this.controls.enabled = true;
            this.activeCamera = this.defaultCamera;
        } else {
            this.controls.enabled = false;
            this.content.traverse((node) => {
                if (node.isCamera && node.name === name) {
                    this.activeCamera = node;
                }
            });
        }
    }
    updateLights() {
        const state = this.state;
        const lights = this.lights;

        if (state.addLights && !lights.length) {
            this.addLights();
        } else if (!state.addLights && lights.length) {
            this.removeLights();
        }

        this.renderer.toneMappingExposure = state.exposure;

        if (lights.length === 2) {
            lights[0].intensity = state.ambientIntensity;
            lights[0].color.setHex(state.ambientColor);
            lights[1].intensity = state.directIntensity;
            lights[1].color.setHex(state.directColor);
        }
    }
    addLights() {
        const state = this.state;

        const light1 = new THREE.AmbientLight(state.ambientColor, state.ambientIntensity);
        light1.name = 'ambient_light';
        this.defaultCamera.add(light1);

        const light2 = new THREE.DirectionalLight(state.directColor, state.directIntensity);
        light2.position.set(0.5, 0, 0.866); // ~60º
        light2.name = 'main_light';
        this.defaultCamera.add(light2);

        this.lights.push(light1, light2);
    }
    removeLights() {
        this.lights.forEach((light) => light.parent.remove(light));
        this.lights.length = 0;
    }
    updateEnvironment() {

        this.getCubeMapTexture().then(({ envMap, cubeMap }) => {
            this.traverseMaterials(this.content, (material) => {
                if (material.isMeshStandardMaterial || material.isGLTFSpecularGlossinessMaterial) {
                    material.envMap = envMap;
                    material.needsUpdate = true;
                }
            });
        });

    }
    getCubeMapTexture() {
        return new Promise((resolve) => {
            const envMap = new THREE.CubeTextureLoader()
                .setPath("environment/envReflection/")
                .load([
                    'px.jpg',
                    'nx.jpg',
                    'py.jpg',
                    'ny.jpg',
                    'pz.jpg',
                    'nz.jpg'
                ]);
            envMap.format = THREE.RGBFormat;
            console.log(envMap)
            resolve({ envMap, cubeMap: envMap })
        })
    }
    updateTextureEncoding() {
        // const encoding = this.state.textureEncoding === 'sRGB' ? THREE.sRGBEncoding : THREE.LinearEncoding;
        const encoding = THREE.sRGBEncoding;
        this.traverseMaterials(this.content, (material) => {
            if (material.map) material.map.encoding = encoding;
            if (material.emissiveMap) material.emissiveMap.encoding = encoding;
            if (material.map || material.emissiveMap) material.needsUpdate = true;
        });
    }
    setCarObjects() {
        [
            "WheelBR",
            "WheelBL",
            "WheelFR",
            "WheelFL",
        ].map((name) => {
            this.content.traverse((node) => (node.name === name) && this.wheels.push(node));
        })
    }
    rotateWheels(wheel) {
        if (this.state.wheelsCanRotate) {
            wheel.rotation.x += this.state.wheelSpeed;
        }
    }
    printGraph(node) {
        console.group(' <' + node.type + '> ' + node.name);
        node.children.forEach((child) => this.printGraph(child));
        console.groupEnd();
    }
    traverseMaterials(object, callback) {
        object.traverse((node) => {
            if (!node.isMesh) return;
            const materials = Array.isArray(node.material)
                ? node.material
                : [node.material];
            materials.forEach(callback);
        });
    }
}

window.application = new WebGL({
    canvas: document.getElementsByClassName("canvas")[0]
});