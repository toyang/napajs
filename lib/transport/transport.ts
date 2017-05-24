import * as transportable from './transportable';
import * as nontransportable from './non-transportable';

import * as path from 'path';

/// <summary> Per-isolate cid => constructor registry. </summary>
let _registry: Map<string, new(...args: any[]) => transportable.Transportable> 
    = new Map<string, new(...args: any[]) => transportable.Transportable>(); 

/// <summary> Register a TransportableObject sub-class with a Constructor ID (cid). </summary>
export function register(subClass: new(...args: any[]) => any) {
    // Check cid from constructor first, which is for TransportableObject. 
    // Thus we don't need to construct the object to get cid according to Transportable interface. 
    let cid: string = (<any>subClass)['_cid'];
    if (cid == null) {
        cid = new subClass().cid();
    }
    if (cid == null) {
        throw new Error(`Class "${subClass.name}" doesn't have cid property, did you forget put @cid decorator before class declaration?`);
    }
    if (nontransportable.CID === cid) {
        throw new Error(`Class "${subClass.name}" is not transportable.`);
    }
    if (_registry.has(cid)) {
        throw new Error(`Constructor ID (cid) "${cid}" is already registered.`);
    }
    _registry.set(cid, subClass);
}

/// <summary> Marshall a single JS value. </summary> 
function marshallSingle(jsValue: any, context: transportable.TransportContext): any {
    if (transportable.isTransportable(jsValue)) {
        return <transportable.Transportable>(jsValue).marshall(context);
    }
    return jsValue;
}

/// <summary> Unmarshall a single JavaScript value. </summary>
/// <param name="payload"> Plain Javascript value. </param> 
/// <param name="context"> Transport context. </param>
/// <returns> Transported value. </returns>
function unmarshallSingle(payload: any, context: transportable.TransportContext): any {
    if (payload != null && payload._cid !== undefined) {
        let cid = payload._cid;
        let subClass = _registry.get(cid);
        if (subClass == null) {
            throw new Error(`Unrecognized Constructor ID (cid) "${cid}". Please ensure AutoTransfer.register is called on this cid.`);
        }
        let object = new subClass();
        object.unmarshall(payload, context);
        return object;
    }
    return payload;
}

/// <summary> Unmarshall from JSON string to a JavaScript value, which could contain complex/native objects. </summary>
/// <param name="json"> JSON string. </summary>
/// <param name="reviver"> Reviver that transform parsed values into new values. </param>
/// <returns> Parsed JavaScript value, which could be built-in JavaScript types or deserialized Transportable objects. </returns>
export function unmarshall(
    json: string, 
    context: transportable.TransportContext, 
    reviver?: (key: any, value: any) => any): any {
    
    return JSON.parse(json, 
        (key: any, value: any): any => {
            value = unmarshallSingle(value, context);
            if (reviver != null) {
                value = reviver(key, value);
            }
            return value;
        });
}

/// <summary> Marshall a JavaScript value to JSON. </summary>
/// <param name="jsValue"> JavaScript value to stringify, which maybe built-in JavaScript types or transportable objects. </param>
/// <param name="replacer"> Replace JS value with transformed value before writing to string. </param>
/// <param name="space"> Space used to format JSON. </param>
/// <returns> JSON string. </returns>
export function marshall(
    jsValue: any, 
    context: transportable.TransportContext, 
    replacer?: (key: string, value: any) => any, 
    space?: string | number): string {
    
    return JSON.stringify(jsValue,
        (key: string, value: any) => {
            value = marshallSingle(value, context);
            if (replacer) {
                value = replacer(key, value);
            }
            return value;
        },
        space);
} 