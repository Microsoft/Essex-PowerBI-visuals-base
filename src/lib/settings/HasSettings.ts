import {
    fromJSON,
    toJSON,
    buildCapabilitiesObjects,
    buildPersistObjects,
    buildEnumerationObjects,
    parseSettingsFromPBI,
} from "./helpers";
const assignIn = require("lodash/assignIn"); // tslint:disable-line

/**
 * A simple class with methods to handle the basic settings manipulation
 */
export class HasSettings {

    /**
     * Rehydrates this settings class from the given object
     */
    public static fromJSON<T extends HasSettings>(obj: any): T {
        return fromJSON<any>(this, obj);
    }

    /**
     * Builds the capability objects for this settings class
     */
    public static fromPBI<T extends HasSettings>(dv?: powerbi.DataView, additionalProps?: any): T {
        return parseSettingsFromPBI(this, dv, additionalProps) as T;
    }

    /**
     * Builds the capability objects for this settings class
     */
    public static buildCapabilitiesObjects() {
        return buildCapabilitiesObjects(this);
    }

    /**
     * Recieves the given object and returns a new state with the object overlayed with the this set of settings
     */
    public receive<T extends HasSettings>(newProps?: any) {
        return assignIn(fromJSON<any>(this.constructor as any, this.toJSONObject()), newProps);
    }

    /**
     * Recieves the given pbi settings and returns a new state with the new pbi settings overlayed with the this state
     */
    public receivePBISettings<T extends HasSettings>(dv?: powerbi.DataView) {
        return parseSettingsFromPBI(this.constructor as any, dv, this.toJSONObject()) as T;
    }

    /**
     * Builds the persist objects
     */
    public buildEnumerationObjects(objectName: string, dataView: powerbi.DataView, includeHidden = false) {
        return buildEnumerationObjects(this.constructor as any, this, objectName, dataView, includeHidden);
    }

    /**
     * Builds the persist objects
     */
    public buildPersistObjects(dataView: powerbi.DataView, includeHidden = false) {
        return buildPersistObjects(this.constructor as any, this, dataView, includeHidden);
    }

    /**
     * Converts this class into a json object.
     */
    public toJSONObject() { // Important that this is not called "toJSON" otherwise infinite loops
        return toJSON(this.constructor as any, this);
    }
}