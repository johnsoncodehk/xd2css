const { selection } = require("scenegraph");
let panel;

function create() {
    const HTML =
        `<style>
            #preview {
                width: 100%;
                height: 100px;
            }
            #output {
                width: 100%;
                margin: 0;
                padding: 0;
            }
            .show {
                display: block;
            }
            .hide {
                display: none;
            }
        </style>

        <h2>Affected by</h2>
        <label>
            <input type="checkbox" id="size">
            <span>Size</span>
        </label>
        <br>
        <label>
            <input type="checkbox" id="rotation">
            <span>Rotation</span>
            </label>
        <br>
        <label>
            <input type="checkbox" id="opacity">
            <span>Opacity</span>
        </label>
        <div id="outputs">
            <h2>Preview</h2>
            <div id="preview"></div>
            <h2>Output</h2>
            <textarea id="output"></textarea>
        </div>
        <p id="warning">Please select a "Linear Gradient" fill rectangle.</p>
        `

    panel = document.createElement("div");
    panel.innerHTML = HTML;

    panel.querySelector("#size").addEventListener("change", update);
    panel.querySelector("#rotation").addEventListener("change", update);
    panel.querySelector("#opacity").addEventListener("change", update);

    return panel;
}

function show(event) {
    if (!panel) event.node.appendChild(create());
}

function update() {
    let outputs = document.querySelector("#outputs");
    let preview = document.querySelector("#preview");
    let output = document.querySelector("#output");
    let warning = document.querySelector("#warning");

    if (!selection || !selection.items[0] || !selection.items[0].fill || !selection.items[0].fill.colorStops) {
        outputs.className = "hide";
        warning.className = "show";
    } else {
        outputs.className = "show";
        warning.className = "hide";

        const rect = selection.items[0];
        const fill = rect.fill;
        const useSize = document.querySelector("#size");
        const useRotation = document.querySelector("#rotation");
        const useOpacity = document.querySelector("#opacity");

        let width = 1;
        let height = 1;
        let opacity = 1;
        let rotation = 0;

        if (useSize.checked) {
            if (rect.width !== undefined && rect.height !== undefined) {
                width = rect.width;
                height = rect.height;
            }
            else if (rect.localBounds !== undefined) {
                width = rect.localBounds.width;
                height = rect.localBounds.height;
            }
            else {
                output.innerHTML = "[Error] Can't get width, height";
                return;
            }
        }
        if (useRotation.checked) {
            if (rect.rotation !== undefined) {
                rotation = rect.rotation;
            }
            else {
                output.innerHTML = "[Error] Can't get rotation";
                return;
            }
        }
        if (useOpacity.checked) {
            if (rect.opacity !== undefined) {
                opacity = rect.opacity;
            }
            else {
                output.innerHTML = "[Error] Can't get opacity";
                return;
            }
        }

        const result = convert(fill.startX, fill.startY, fill.endX, fill.endY, fill.colorStops, width, height, opacity, rotation);
        const colorStr = result.stops.map(stop => `${stop.color} ${round(stop.offset * 100)}%`).join(", ");
        const gradientStr = `linear-gradient(${round(result.angle)}deg, ${colorStr})`;

        preview.style.background = gradientStr;
        output.innerHTML = gradientStr;
    }
}

function convert(x1, y1, x2, y2, colorStops, width, height, opacity, rotation) {

    const p1 = { x: x1, y: y1 };
    const p2 = { x: x2, y: y2 };

    p1.y *= height / width;
    p2.y *= height / width;
    p1.y *= -1;
    p2.y *= -1;

    const angle = getGradientAngle(p1, p2);
    const points = getStartEndPoints(p1, p2, angle, width, height);
    const stops = getGradientStops(colorStops, opacity);

    const startPoint = points[0];
    const endPoint = points[1];

    for (const stop of stops) {
        if (endPoint.x != startPoint.x) {
            const x0 = p1.x + stop.offset * (p2.x - p1.x);
            const t = (x0 - startPoint.x) / (endPoint.x - startPoint.x);
            stop.offset = t;
        }
        else {
            const y0 = p1.y + stop.offset * (p2.y - p1.y);
            const t = (y0 - startPoint.y) / (endPoint.y - startPoint.y);
            stop.offset = t;
        }
    }

    return {
        angle: angle + rotation,
        stops: stops,
    };
}

function getGradientAngle(p1, p2) {
    if (p1.x == p2.x) {
        return p2.y > p1.y ? 0 : 180;
    }
    else if (p1.y == p2.y) {
        return p2.x > p1.x ? 90 : -90;
    }

    const x0 = p1.x;
    const y0 = p1.y + 1;
    const AB = Math.sqrt(Math.pow(p1.x - x0, 2) + Math.pow(p1.y - y0, 2));
    const BC = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    const AC = Math.sqrt(Math.pow(p2.x - x0, 2) + Math.pow(p2.y - y0, 2));
    let angle = Math.acos((BC * BC + AB * AB - AC * AC) / (2 * BC * AB)) * 180 / Math.PI;

    if (p2.x < p1.x) {
        angle *= -1;
    }
    while (angle < 0) {
        angle += 360;
    }
    while (angle >= 360) {
        angle -= 360;
    }

    return angle;
}

function getStartEndPoints(p1, p2, angle, width, height) {

    let output = undefined;
    const dy = p2.y - p1.y;
    const dx = p2.x - p1.x;

    if (dy == 0) {
        if (dx > 0) {
            output = [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }];
        }
        else {
            output = [{ x: 1, y: 0.5 }, { x: 0, y: 0.5 }];
        }
    }
    else if (dx == 0) {
        if (dy > 0) {
            output = [{ x: 0.5, y: -1 }, { x: 0.5, y: 0 }];
        }
        else {
            output = [{ x: 0.5, y: 0 }, { x: 0.5, y: -1 }];
        }
    }

    if (!!output) {
        output[0].y *= height / width;
        output[1].y *= height / width;
        return output;
    }

    const A = { x: 0, y: 0 }; // left top
    const B = { x: 1, y: 0 }; // right top
    const C = { x: 1, y: -1 }; // right bottom
    const D = { x: 0, y: -1 }; // left bottom

    A.y *= height / width;
    B.y *= height / width;
    C.y *= height / width;
    D.y *= height / width;

    let startPoint = undefined;
    let endPoint = undefined;

    if (angle <= 90) {
        startPoint = D;
        endPoint = B;
    }
    else if (angle <= 180) {
        startPoint = A;
        endPoint = C;
    }
    else if (angle <= 270) {
        startPoint = B;
        endPoint = D;
    }
    else {
        startPoint = C;
        endPoint = A;
    }

    const m = -dx / dy;
    const start = segmentsIntr(
        { x: p1.x, y: p1.y },
        { x: p2.x, y: p2.y },
        { x: startPoint.x, y: startPoint.y },
        { x: startPoint.x + 1, y: startPoint.y + (1 * m) },
    );
    const end = segmentsIntr(
        { x: p1.x, y: p1.y },
        { x: p2.x, y: p2.y },
        { x: endPoint.x, y: endPoint.y },
        { x: endPoint.x + 1, y: endPoint.y + (1 * m) },
    );

    return [start, end];
}

function segmentsIntr(a, b, c, d) {
    const denominator = (b.y - a.y) * (d.x - c.x) - (a.x - b.x) * (c.y - d.y);
    if (denominator == 0) {
        return undefined;
    }

    const x = ((b.x - a.x) * (d.x - c.x) * (c.y - a.y)
        + (b.y - a.y) * (d.x - c.x) * a.x
        - (d.y - c.y) * (b.x - a.x) * c.x) / denominator;
    const y = -((b.y - a.y) * (d.y - c.y) * (c.x - a.x)
        + (b.x - a.x) * (d.y - c.y) * a.y
        - (d.x - c.x) * (b.y - a.y) * c.y) / denominator;

    return {
        x: x,
        y: y
    };
}

function getGradientStops(stops, rectOpacity) {
    return stops.map(stop => {
        let offset = stop.stop;
        let color = stop.color;
        color.a *= rectOpacity;

        if (color.a != 255) {
            color = `rgba(${color.r}, ${color.g}, ${color.b}, ${round(color.a / 255)})`;
        }
        else {
            color = color.toHex(true);
        }

        return { offset, color };
    });
}

function round(value) {
    return Math.round(value * 100) / 100;
}

module.exports = {
    commands: {
    },
    panels: {
        mainPanel: {
            show,
            update
        }
    },
};
