import * as THREE from 'three';
import { GeometryData } from '../../modeling/GeometryData';
import { BladeCrossSection } from './BladeCrossSection';
import { CrossSection } from '../../modeling/CrossSection';

export const TIP_GEOMETRIES = ["standard", "rounded", "square", "clip"];

/**
 * Swords are the core of this API and manage information about
 * their 3D geometry
 */
export class BladeGeometry extends GeometryData{

    private readonly _totalLength: number;
    private _currentLength: number;
    private _color?: THREE.Color;
    private _bladeEdgeVertices: number[];
    private _activeEdgeCurve?: THREE.Curve<THREE.Vector2>;
    private _extrusionCurve?: THREE.Curve<THREE.Vector2>;

    /**
     * Creates an instance of sword
     *
     * @constructor
     */
    constructor(length: number, extrusionCurve?: THREE.Curve<THREE.Vector2>) {
        super();
        this._totalLength = length;
        this._currentLength = 0;
        this._bladeEdgeVertices = [];
        this._extrusionCurve = extrusionCurve;
    }

    setEdgeCurve(curve: THREE.Curve<THREE.Vector2>): this {
        this._activeEdgeCurve = curve;
        return this;
    }

    /**
     * Extrudes the blade along the extrusion curve
     * @param distance
     */
    extrude(distance: number): this {

        if (this._activeCrossSection === undefined) {
            throw new Error("BladeGeometry does not have an active cross section");
        }

        if (this._extrusionCurve === undefined) {
            super.extrude(distance);
            return this;
        }

        this._currentLength += distance;
        var t = this._currentLength / this._totalLength;

        super.extrude(distance);

        var extrusionPoint2D = this._extrusionCurve.getPoint(t).multiplyScalar(this._totalLength);
        var extrusionPoint3D = new THREE.Vector3(0, extrusionPoint2D.y, extrusionPoint2D.x);
        var crossSectionPos = this._activeCrossSection.getTranslation();
        var toExtrusionPoint = new THREE.Vector3().subVectors(extrusionPoint3D, crossSectionPos);

        this.translate(toExtrusionPoint);

        var extrusionNorm2D = this._extrusionCurve.getTangent(t);
        var extrusionNorm3D = new THREE.Vector3(0, extrusionNorm2D.y, extrusionNorm2D.x);
        var crossSectionNorm = this._activeCrossSection.getNorm().normalize();
        var rotateAngle = new THREE.Quaternion().setFromUnitVectors(crossSectionNorm, extrusionNorm3D);

        this.rotate(rotateAngle);

        return this;
    }

    /**
     * Extrudes the active crossection along a given extrusion curve
     * while also modifying the edge vertices to match the given edge curve.
     *
     * @param edgeCurve
     * @param samplingResolution
     * @param length
     */
    extrudeSection(
        edgeCurve: THREE.Curve<THREE.Vector2>,
        nSubdivisions: number,
        length: number,
        taper?: number | THREE.Vector2): this {

        this.setEdgeCurve(edgeCurve);

        // distance of each intermediate extrusion along the curve
        var sampleInterval = length / nSubdivisions;
        var taperInterval: number | THREE.Vector2 = 1;

        if (typeof(taper) === 'number') {
            taperInterval = 1 - (taper / nSubdivisions);
        } else if (taper instanceof THREE.Vector2) {
            taperInterval = new THREE.Vector2(1, 1).sub(taper?.divideScalar(nSubdivisions));
        }

        for (let i = 1; i <= nSubdivisions; i++) {
            this.extrude(sampleInterval);
            this.modifyEdgeVerts(sampleInterval * i / length);
            if (taper)
                this.scale(taperInterval);
        }

        return this;
    }

    createTip(style: string, length: number, nSubdivisions = 5): this {

        if (this._activeCrossSection === undefined) {
            throw new Error("BladeGeometry does not have an active cross section");
        }

        if (style === "standard") {
            this.extrude(length);
            this.scale(0);
            return this;
        }

        if (style === "rounded") {
            var tipCurve = new THREE.QuadraticBezierCurve(
                new THREE.Vector2(1, 0),
                new THREE.Vector2(0.7, 0.2),
                new THREE.Vector2(0, 1)
            );

            var subTotalHeight = 0;
            for (let i = 0; i < nSubdivisions; i++) {
                this.extrude(length / nSubdivisions);
                subTotalHeight += length / nSubdivisions;
                if (i == nSubdivisions - 1) {
                    this.scale(0);
                    continue;
                }

                this.scale(tipCurve.getPoint(subTotalHeight / length).x);
            }

            return this;
        }

        if (style === "square") {
            this.extrude(length);
            this.scale(new THREE.Vector2(0, 1));
            return this;
        }

        if (style === "clip") {
            this.extrude(length);
            this.rotate(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI/3));
            this.scale(new THREE.Vector2(0, 1));
            return this;
        }

        // standard tip
        this.extrude(length);
        this.scale(0);
        return this;
    }

    /**
     * Samples the active edge curve and sets the edge verts
     * of the active cross section accordingly
     *
     * @param samplePoint Nubmber from [0, 1] used to sample the curve
     */
    modifyEdgeVerts(samplePoint: number): this {
        if (this._activeCrossSection === undefined) {
            throw new Error("BladeGeometry does not have an active cross section");
        }

        if (this._activeEdgeCurve === undefined) {
            throw new Error("BladeGeometry does not have an active edge curve");
        }

        let edgeScaleFactor = this._activeEdgeCurve.getPoint(samplePoint).x + 1;

        for (let i = 0; i < this._bladeEdgeVertices.length; i++) {
            this._activeCrossSection.scaleVertex(this._bladeEdgeVertices[i], edgeScaleFactor);
        }

        return this;
    }

    setBladeCrossSection(crossSection: CrossSection, edgeVerts: number[], color?: THREE.Color): this {
        super.setCrossSection(crossSection, color);
        this._bladeEdgeVertices = edgeVerts;
        return this;
    }
}