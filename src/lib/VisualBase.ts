/*
 * MIT License
 *
 * Copyright (c) 2016 Microsoft
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import "powerbi-visuals/lib/powerbi-visuals";

import { elementLogWriter, logger } from "./utils";
import { CatchingVisualBase } from "./CatchingVisualBase";
import { receiveUpdateType, IUpdateTypeReceiver } from "./utils/receiveUpdateType";
import UpdateType from "./utils/UpdateType";
import * as $ from "jquery";

const log = require("debug")("essex:PbiBase"); // tslint:disable-line

@receiveUpdateType()
export default class VisualBase extends CatchingVisualBase implements IUpdateTypeReceiver {
    // TODO: Switch this to a build config
    public static EXPERIMENTAL_ENABLED = false;

    /**
     * True if the sandbox is enabled by default
     */
    public static DEFAULT_SANDBOX_ENABLED = window.parent === window; /* Checks if we are in an iframe */;

    /**
     * The set of capabilities for the visual
     */
    public static capabilities: powerbi.VisualCapabilities = VisualBase.EXPERIMENTAL_ENABLED ? {
        objects: {
            experimental: {
                displayName: "Experimental",
                properties: {
                    sandboxed: {
                        type: { bool: true },
                        displayName: "Enable to sandbox the visual into an IFrame",
                    },
                },
            },
        },
    } : {};

    protected element: JQuery;
    protected container: JQuery;
    protected loadSandboxed: boolean;
    private parent: JQuery;
    private _sandboxed: boolean;
    private width: number;
    private height: number;
    private cssModule: any;

    public get template() {
        return "";
    }

    /**
     * Constructor for the Visual
     * @param logger The logger used for logging, if provided, the logger will log events to the log element contained in this visual
     */
    constructor(name: string, noCss = false) {
        super(name);
        logger.addWriter(elementLogWriter(() => {
            const ele = this.element.find(".logArea");
            ele.css({ display: "block" });
            return ele;
        }));

        if (!noCss) {
            this.cssModule = require("!css!sass!./../../css/main.scss");
        }

        this.element = $("<div class='visual-base' style='height:100%;width:100%;'/>");

        // Add a Logging area
        this.element.append($(`<div class="logArea"></div>`));

        // Add Custom Styles
        const promises = this.getExternalCssResources().map((resource) => this.buildExternalCssLink(resource));
        $.when.apply($, promises).then((...styles: string[]) => this.element.append(styles.map((s) => $(s))));
        this.element.append($("<st" + "yle>" + this.getCss().join("\n") + "</st" + "yle>"));

        // Append Template
        if (this.template) {
            this.element = this.element.append($(this.template));
        }
    }

    /** This is called once when the visual is initialially created */
    protected doInit(options: powerbi.VisualInitOptions): void {
        this.width = options.viewport.width;
        this.height = options.viewport.height;
        this.container = options.element;
        this.attach(typeof this.loadSandboxed !== "undefined" ? this.loadSandboxed : VisualBase.DEFAULT_SANDBOX_ENABLED);
    }

    /**
     * Notifies the IVisual of an update (data, viewmode, size change).
     */
    public updateWithType(options: powerbi.VisualUpdateOptions, updateType: UpdateType) {
        this.width = options.viewport.width;
        this.height = options.viewport.height;

        const dataView = options.dataViews && options.dataViews[0];
        if (dataView) {
            if (VisualBase.EXPERIMENTAL_ENABLED) {
                const objs = dataView.metadata.objects;
                const experimental = objs && objs["experimental"];
                let sandboxed = experimental && experimental["sandboxed"];
                sandboxed = typeof sandboxed === "undefined" ? VisualBase.DEFAULT_SANDBOX_ENABLED : sandboxed;
                if (this.sandboxed !== sandboxed) {
                    this._sandboxed = sandboxed;
                }
            }
        }
        this.parent.css({width: this.width, height: this.height});
    }

    /**
     * Enumerates the instances for the objects that appear in the power bi panel
     */
    protected handleEnumerateObjectInstances(
        options: powerbi.EnumerateVisualObjectInstancesOptions
    ): powerbi.VisualObjectInstanceEnumeration {
        if (options.objectName === "experimental" && VisualBase.EXPERIMENTAL_ENABLED) {
            return [{
                selector: null, // tslint:disable-line
                objectName: "experimental",
                properties: {
                    sandboxed: this.sandboxed,
                },
            }];
        }
        return [];
    }

    /**
     * Sets the sandboxed state
     */
    protected attach(isSandboxed: boolean) {
        this._sandboxed = isSandboxed;
        this.element.detach();

        /**
         * Adds the module class name to given element
         */
        const addClassName = (ele: JQuery) => {
            const classNameToAdd = this.cssModule && this.cssModule.locals && this.cssModule.locals.className;
            if (ele && classNameToAdd) {
                log("Attach::Adding Classes");
                ele.addClass(classNameToAdd);
            }
        };

        if (this.parent) {
            log("Attach::Remove Parent");
            this.parent.remove();
        }

        if (isSandboxed) {
            log("Attach::Sandboxed");
            this.parent = $(`<iframe style="width:${this.width}px;height:${this.height}px;border:0;margin:0;padding:0" frameBorder="0"/>`);

            // Important that this happens first, otherwise there might not be a body
            this.container.append(this.parent);

            if (typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().indexOf("firefox") > -1) {
                log("Attach::Firefox or No Navigator");
                // If you append the element without doing this, the iframe will load
                // after you've appended it and remove everything that you added
                this.parent[0].onload = () => {
                    setTimeout(() => {
                        this.HACK_fonts();
                        this.parent.contents().find("body").append(this.element);
                        addClassName(this.parent.contents().find("html"));
                    }, 0);
                };
            } else {
                log("Attach::Not Firefox");
                this.parent.contents().find("head").append($('<meta http-equiv="X-UA-Compatible" content="IE=edge">'));
                this.parent.contents().find("body").append(this.element);
                this.HACK_fonts();
                addClassName(this.parent.contents().find("html"));
            }
        } else {
            log("Attach::Not Sandboxed");
            this.parent = $(`<div style="width:${this.width}px;height:${this.height}px;border:0;margin:0;padding:0"/>`);
            this.parent.append(this.element);
            this.container.append(this.parent);
            addClassName(this.parent);
        }
    }

    /**
     *
     */
    public get sandboxed() {
        return this._sandboxed;
    }

    /**
     * Gets the inline css used for this element
     */
    protected getCss(): string[] {
        return this.cssModule ? [this.cssModule + ""] : [];
    }

    /**
     * Builds the link for the given external css resource
     */
    protected buildExternalCssLink(resource: ExternalCssResource): JQueryPromise<string> {
        const link = "li" + "nk";
        const integrity = resource.integrity ? `integrity="${resource.integrity}"` : "";
        const href = `href="${resource.url}"`;
        const crossorigin = resource.crossorigin ? ` crossorigin="${resource.crossorigin}"` : "";
        const rel = 'rel="stylesheet"';
        const defer = $.Deferred<string>();
        defer.resolve(`<${link} ${href} ${rel} ${integrity} ${crossorigin}>`);
        return defer.promise();
    }

    /**
     * Gets the external css paths used for this visualization
     */
    protected getExternalCssResources(): ExternalCssResource[] {
        return [];    }
    private HACK_fonts() {
        let faces = this.HACK_getFontFaces();
        this.element.prepend($("<st" + "yle>" + (Object.keys(faces).map(n => faces[n].cssText)).join("\n") + "</st" + "yle>"));
    }

    private HACK_getFontFaces(obj?: any) {
        const sheet = document.styleSheets;
        let i = sheet.length;
        let result = {};
        while (0 <= --i) {
            try {
                let rule = sheet[i]["rules"] || sheet[i]["cssRules"] || [];
                let j = rule.length;
                while (0 <= --j) {
                    if (rule[j].constructor.name === "CSSFontFaceRule" ||
                        rule[j].constructor.toString().indexOf("CSSFontFaceRule") >= 0) {
                        const style = rule[j].style;
                        let fontFamily = style.fontFamily;
                        if (!fontFamily && style.getPropertyValue) {
                            fontFamily = style.getPropertyValue("font-family");
                        }
                        result[fontFamily] = rule[j];
                    }
                    ;
                }
            } catch (e) {
                if (e.name !== "SecurityError") {
                    throw e;
                }
            }
        }
        return result;
    }
}

/**
 * Specifies an external css resource
 */
export interface ExternalCssResource {
    /**
     * The url of the resource
     */
    url: string;

    /**
     * The integrity string of the resource
     */
    integrity?: string;

    /**
     * The cross origin of the resource
     */
    crossorigin?: string;
}
