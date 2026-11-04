/* Lumen Cards: desktop <-> phone morph. No libraries, no network beyond its own images. Only transform and opacity animate. */
(function () {
  "use strict";
  var DATA = {"en":{"cards":[{"k":"title","role":"centre","d":[384,124,332,56],"p":[359,384,382,26],"di":true,"pi":true,"fab":false,"dc":[384,124],"pc":[4,384],"y0":0.178,"row":0.539,"z":0},{"k":"light","role":"centre","d":[384,180,166,52],"p":[359,410,191,52],"di":true,"pi":true,"fab":false,"dc":[384,180],"pc":[4,410],"y0":0.256,"row":0.575,"z":0},{"k":"light","role":"centre","d":[550,180,166,52],"p":[550,410,191,52],"di":true,"pi":true,"fab":false,"dc":[550,180],"pc":[195,410],"y0":0.256,"row":0.575,"z":0},{"k":"light","role":"centre","d":[384,232,166,52],"p":[359,462,191,52],"di":true,"pi":true,"fab":false,"dc":[384,232],"pc":[4,462],"y0":0.328,"row":0.647,"z":0},{"k":"light","role":"centre","d":[550,232,166,52],"p":[550,462,191,52],"di":true,"pi":true,"fab":false,"dc":[550,232],"pc":[195,462],"y0":0.328,"row":0.647,"z":0},{"k":"light","role":"centre","d":[384,284,166,52],"p":[359,514,191,52],"di":true,"pi":true,"fab":false,"dc":[384,284],"pc":[4,514],"y0":0.4,"row":0.719,"z":0},{"k":"title","role":"centre","d":[384,336,332,36],"p":[359,566,382,32],"di":true,"pi":true,"fab":false,"dc":[384,336],"pc":[4,566],"y0":0.472,"row":0.792,"z":0},{"k":"light","role":"centre","d":[384,372,166,52],"p":[359,598,191,52],"di":true,"pi":true,"fab":false,"dc":[384,372],"pc":[4,598],"y0":0.522,"row":0.836,"z":0},{"k":"light","role":"centre","d":[550,372,166,52],"p":[550,598,191,52],"di":true,"pi":true,"fab":false,"dc":[550,372],"pc":[195,598],"y0":0.522,"row":0.836,"z":0},{"k":"light","role":"centre","d":[384,424,166,52],"p":[359,650,191,52],"di":true,"pi":true,"fab":false,"dc":[384,424],"pc":[4,650],"y0":0.594,"row":0.908,"z":0},{"k":"light","role":"centre","d":[550,424,166,52],"p":[550,650,191,52],"di":true,"pi":true,"fab":false,"dc":[550,424],"pc":[195,650],"y0":0.594,"row":0.908,"z":0},{"k":"greeting","role":"other","d":[141.40625,20,218.59375,106.796875],"p":[359,60,286.5,48],"di":true,"pi":true,"fab":false,"dc":[141.40625,20],"pc":[4,60],"y0":0.033,"row":0.089,"z":1},{"k":"weather","role":"other","d":[141.40625,126.796875,218.59375,52.0],"p":[645.5,60,95.5,48],"di":true,"pi":true,"fab":false,"dc":[141.40625,126.796875],"pc":[290.5,60],"y0":0.182,"row":0.089,"z":1},{"k":"title","role":"other","d":[141.40625,178.796875,218.59375,27.1875],"p":null,"di":true,"pi":false,"fab":false,"dc":[141.40625,178.796875],"pc":null,"y0":0.254,"row":0,"z":1},{"k":"alarm","role":"other","d":[141.40625,205.984375,218.59375,68.0],"p":null,"di":true,"pi":false,"fab":false,"dc":[141.40625,205.984375],"pc":null,"y0":0.292,"row":0,"z":1},{"k":"alarm","role":"other","d":[141.40625,273.984375,218.59375,68.0],"p":null,"di":true,"pi":false,"fab":false,"dc":[141.40625,273.984375],"pc":null,"y0":0.386,"row":0,"z":1},{"k":"title","role":"other","d":[141.40625,341.984375,218.59375,27.1875],"p":null,"di":true,"pi":false,"fab":false,"dc":[141.40625,341.984375],"pc":null,"y0":0.481,"row":0,"z":1},{"k":"person","role":"other","d":[141.40625,369.171875,218.59375,52.0],"p":[359,108,191,52],"di":true,"pi":true,"fab":false,"dc":[141.40625,369.171875],"pc":[4,108],"y0":0.518,"row":0.156,"z":1},{"k":"person","role":"other","d":[141.40625,421.171875,218.59375,52.0],"p":[550,108,191,52],"di":true,"pi":true,"fab":false,"dc":[141.40625,421.171875],"pc":[195,108],"y0":0.591,"row":0.156,"z":1},{"k":"chips","role":"other","d":[384,20,332,104],"p":null,"di":true,"pi":false,"fab":false,"dc":[384,20],"pc":null,"y0":0.033,"row":0,"z":1},{"k":"title","role":"other","d":[384,476,166,32],"p":[359,702,191,18],"di":true,"pi":true,"fab":false,"dc":[384,476],"pc":[4,702],"y0":0.667,"row":0.981,"z":1},{"k":"chips","role":"other","d":[384,508,166,52],"p":null,"di":true,"pi":false,"fab":false,"dc":[384,508],"pc":null,"y0":0.711,"row":1.025,"z":1},{"k":"light","role":"other","d":[384,560,166,52],"p":null,"di":true,"pi":false,"fab":false,"dc":[384,560],"pc":null,"y0":0.783,"row":1.097,"z":1},{"k":"title","role":"other","d":[550,476,166,32],"p":[550,702,191,18],"di":true,"pi":true,"fab":false,"dc":[550,476],"pc":[195,702],"y0":0.667,"row":0.981,"z":1},{"k":"light","role":"other","d":[550,508,166,52],"p":null,"di":true,"pi":false,"fab":false,"dc":[550,508],"pc":null,"y0":0.711,"row":1.025,"z":1},{"k":"chips","role":"other","d":[550,560,166,52],"p":null,"di":true,"pi":false,"fab":false,"dc":[550,560],"pc":null,"y0":0.783,"row":1.097,"z":1},{"k":"title","role":"other","d":[384,612,332,56],"p":null,"di":true,"pi":false,"fab":false,"dc":[384,612],"pc":null,"y0":0.856,"row":1.169,"z":1},{"k":"title","role":"other","d":[384,668,110.65625,36],"p":null,"di":true,"pi":false,"fab":false,"dc":[384,668],"pc":null,"y0":0.933,"row":1.206,"z":1},{"k":"chips","role":"other","d":[384,704,110.65625,16],"p":null,"di":true,"pi":false,"fab":false,"dc":[384,704],"pc":null,"y0":0.983,"row":1.25,"z":1},{"k":"title","role":"other","d":[494.65625,668,110.671875,36],"p":null,"di":true,"pi":false,"fab":false,"dc":[494.65625,668],"pc":null,"y0":0.933,"row":1.206,"z":1},{"k":"light","role":"other","d":[494.65625,704,110.671875,16],"p":null,"di":true,"pi":false,"fab":false,"dc":[494.65625,704],"pc":null,"y0":0.983,"row":1.25,"z":1},{"k":"title","role":"other","d":[605.328125,668,110.671875,36],"p":null,"di":true,"pi":false,"fab":false,"dc":[605.328125,668],"pc":null,"y0":0.933,"row":1.394,"z":1},{"k":"chips","role":"other","d":[605.328125,704,110.671875,16],"p":null,"di":true,"pi":false,"fab":false,"dc":[605.328125,704],"pc":null,"y0":0.983,"row":1.439,"z":1},{"k":"title","role":"other","d":[740,20,267.1875,27.1875],"p":null,"di":true,"pi":false,"fab":false,"dc":[740,20],"pc":null,"y0":0.033,"row":0,"z":1},{"k":"entity","role":"other","d":[740,47.1875,133.59375,68.0],"p":null,"di":true,"pi":false,"fab":false,"dc":[740,47.1875],"pc":null,"y0":0.071,"row":0,"z":1},{"k":"entity","role":"other","d":[873.59375,47.1875,133.59375,68.0],"p":null,"di":true,"pi":false,"fab":false,"dc":[873.59375,47.1875],"pc":null,"y0":0.071,"row":0,"z":1},{"k":"lock","role":"other","d":[740,115.1875,267.1875,124.0],"p":null,"di":true,"pi":false,"fab":false,"dc":[740,115.1875],"pc":null,"y0":0.166,"row":0,"z":1},{"k":"button","role":"other","d":[740,239.1875,133.59375,68.0],"p":null,"di":true,"pi":false,"fab":false,"dc":[740,239.1875],"pc":null,"y0":0.338,"row":0,"z":1},{"k":"button","role":"other","d":[873.59375,239.1875,133.59375,68.0],"p":null,"di":true,"pi":false,"fab":false,"dc":[873.59375,239.1875],"pc":null,"y0":0.338,"row":0,"z":1},{"k":"title","role":"other","d":[740,307.1875,267.1875,27.1875],"p":null,"di":true,"pi":false,"fab":false,"dc":[740,307.1875],"pc":null,"y0":0.432,"row":0,"z":1},{"k":"air-quality","role":"other","d":[740,334.375,267.1875,76.984375],"p":[359,160,382,44],"di":true,"pi":true,"fab":false,"dc":[740,334.375],"pc":[4,160],"y0":0.47,"row":0.228,"z":1},{"k":"sensor","role":"other","d":[740,411.359375,133.59375,60.0],"p":[359,204,191,44],"di":true,"pi":true,"fab":false,"dc":[740,411.359375],"pc":[4,204],"y0":0.577,"row":0.289,"z":1},{"k":"sensor","role":"other","d":[873.59375,411.359375,133.59375,60.0],"p":[550,204,191,44],"di":true,"pi":true,"fab":false,"dc":[873.59375,411.359375],"pc":[195,204],"y0":0.577,"row":0.289,"z":1},{"k":"climate","role":"other","d":[740,471.359375,267.1875,66.0],"p":null,"di":true,"pi":false,"fab":false,"dc":[740,471.359375],"pc":null,"y0":0.66,"row":0,"z":1},{"k":"fab-sheet","role":"other","d":[740,537.359375,267.1875,60.0],"p":null,"di":true,"pi":false,"fab":false,"dc":[740,537.359375],"pc":null,"y0":0.752,"row":0,"z":1},{"k":"bar","role":"other","d":null,"p":[359,248,382,60],"di":false,"pi":true,"fab":false,"dc":null,"pc":[4,248],"y0":0.35,"row":0.35,"z":1},{"k":"bar","role":"other","d":null,"p":[359,308,382,60],"di":false,"pi":true,"fab":false,"dc":null,"pc":[4,308],"y0":0.433,"row":0.433,"z":1},{"k":"fab","role":"phone","y0":1,"row":1,"d":null,"p":[655,622,84,84],"di":false,"pi":true,"fab":true,"dc":null,"pc":[300,622],"z":2},{"k":"fab","role":"phone","y0":1,"row":1,"d":null,"p":[671,562,68,68],"di":false,"pi":true,"fab":true,"dc":null,"pc":[316,562],"z":2}]},"pl":{"cards":[{"k":"title","role":"centre","d":[384,124,332,56],"p":[359,384,382,26],"di":true,"pi":true,"fab":false,"dc":[384,124],"pc":[4,384],"y0":0.178,"row":0.539,"z":0},{"k":"light","role":"centre","d":[384,180,166,52],"p":[359,410,191,52],"di":true,"pi":true,"fab":false,"dc":[384,180],"pc":[4,410],"y0":0.256,"row":0.575,"z":0},{"k":"light","role":"centre","d":[550,180,166,52],"p":[550,410,191,52],"di":true,"pi":true,"fab":false,"dc":[550,180],"pc":[195,410],"y0":0.256,"row":0.575,"z":0},{"k":"light","role":"centre","d":[384,232,166,52],"p":[359,462,191,52],"di":true,"pi":true,"fab":false,"dc":[384,232],"pc":[4,462],"y0":0.328,"row":0.647,"z":0},{"k":"light","role":"centre","d":[550,232,166,52],"p":[550,462,191,52],"di":true,"pi":true,"fab":false,"dc":[550,232],"pc":[195,462],"y0":0.328,"row":0.647,"z":0},{"k":"light","role":"centre","d":[384,284,166,52],"p":[359,514,191,52],"di":true,"pi":true,"fab":false,"dc":[384,284],"pc":[4,514],"y0":0.4,"row":0.719,"z":0},{"k":"title","role":"centre","d":[384,336,332,36],"p":[359,566,382,32],"di":true,"pi":true,"fab":false,"dc":[384,336],"pc":[4,566],"y0":0.472,"row":0.792,"z":0},{"k":"light","role":"centre","d":[384,372,166,52],"p":[359,598,191,52],"di":true,"pi":true,"fab":false,"dc":[384,372],"pc":[4,598],"y0":0.522,"row":0.836,"z":0},{"k":"light","role":"centre","d":[550,372,166,52],"p":[550,598,191,52],"di":true,"pi":true,"fab":false,"dc":[550,372],"pc":[195,598],"y0":0.522,"row":0.836,"z":0},{"k":"light","role":"centre","d":[384,424,166,52],"p":[359,650,191,52],"di":true,"pi":true,"fab":false,"dc":[384,424],"pc":[4,650],"y0":0.594,"row":0.908,"z":0},{"k":"light","role":"centre","d":[550,424,166,52],"p":[550,650,191,52],"di":true,"pi":true,"fab":false,"dc":[550,424],"pc":[195,650],"y0":0.594,"row":0.908,"z":0},{"k":"greeting","role":"other","d":[141.40625,20,218.59375,106.796875],"p":[359,60,286.5,48],"di":true,"pi":true,"fab":false,"dc":[141.40625,20],"pc":[4,60],"y0":0.033,"row":0.089,"z":1},{"k":"weather","role":"other","d":[141.40625,126.796875,218.59375,52.0],"p":[645.5,60,95.5,48],"di":true,"pi":true,"fab":false,"dc":[141.40625,126.796875],"pc":[290.5,60],"y0":0.182,"row":0.089,"z":1},{"k":"title","role":"other","d":[141.40625,178.796875,218.59375,27.1875],"p":null,"di":true,"pi":false,"fab":false,"dc":[141.40625,178.796875],"pc":null,"y0":0.254,"row":0,"z":1},{"k":"alarm","role":"other","d":[141.40625,205.984375,218.59375,68.0],"p":null,"di":true,"pi":false,"fab":false,"dc":[141.40625,205.984375],"pc":null,"y0":0.292,"row":0,"z":1},{"k":"alarm","role":"other","d":[141.40625,273.984375,218.59375,68.0],"p":null,"di":true,"pi":false,"fab":false,"dc":[141.40625,273.984375],"pc":null,"y0":0.386,"row":0,"z":1},{"k":"title","role":"other","d":[141.40625,341.984375,218.59375,27.1875],"p":null,"di":true,"pi":false,"fab":false,"dc":[141.40625,341.984375],"pc":null,"y0":0.481,"row":0,"z":1},{"k":"person","role":"other","d":[141.40625,369.171875,218.59375,52.0],"p":[359,108,191,52],"di":true,"pi":true,"fab":false,"dc":[141.40625,369.171875],"pc":[4,108],"y0":0.518,"row":0.156,"z":1},{"k":"person","role":"other","d":[141.40625,421.171875,218.59375,52.0],"p":[550,108,191,52],"di":true,"pi":true,"fab":false,"dc":[141.40625,421.171875],"pc":[195,108],"y0":0.591,"row":0.156,"z":1},{"k":"chips","role":"other","d":[384,20,332,104],"p":null,"di":true,"pi":false,"fab":false,"dc":[384,20],"pc":null,"y0":0.033,"row":0,"z":1},{"k":"title","role":"other","d":[384,476,166,32],"p":[359,702,191,18],"di":true,"pi":true,"fab":false,"dc":[384,476],"pc":[4,702],"y0":0.667,"row":0.981,"z":1},{"k":"chips","role":"other","d":[384,508,166,52],"p":null,"di":true,"pi":false,"fab":false,"dc":[384,508],"pc":null,"y0":0.711,"row":1.025,"z":1},{"k":"light","role":"other","d":[384,560,166,52],"p":null,"di":true,"pi":false,"fab":false,"dc":[384,560],"pc":null,"y0":0.783,"row":1.097,"z":1},{"k":"title","role":"other","d":[550,476,166,32],"p":[550,702,191,18],"di":true,"pi":true,"fab":false,"dc":[550,476],"pc":[195,702],"y0":0.667,"row":0.981,"z":1},{"k":"light","role":"other","d":[550,508,166,52],"p":null,"di":true,"pi":false,"fab":false,"dc":[550,508],"pc":null,"y0":0.711,"row":1.025,"z":1},{"k":"chips","role":"other","d":[550,560,166,52],"p":null,"di":true,"pi":false,"fab":false,"dc":[550,560],"pc":null,"y0":0.783,"row":1.097,"z":1},{"k":"title","role":"other","d":[384,612,332,56],"p":null,"di":true,"pi":false,"fab":false,"dc":[384,612],"pc":null,"y0":0.856,"row":1.169,"z":1},{"k":"title","role":"other","d":[384,668,110.65625,36],"p":null,"di":true,"pi":false,"fab":false,"dc":[384,668],"pc":null,"y0":0.933,"row":1.206,"z":1},{"k":"chips","role":"other","d":[384,704,110.65625,16],"p":null,"di":true,"pi":false,"fab":false,"dc":[384,704],"pc":null,"y0":0.983,"row":1.25,"z":1},{"k":"title","role":"other","d":[494.65625,668,110.671875,36],"p":null,"di":true,"pi":false,"fab":false,"dc":[494.65625,668],"pc":null,"y0":0.933,"row":1.206,"z":1},{"k":"light","role":"other","d":[494.65625,704,110.671875,16],"p":null,"di":true,"pi":false,"fab":false,"dc":[494.65625,704],"pc":null,"y0":0.983,"row":1.25,"z":1},{"k":"title","role":"other","d":[605.328125,668,110.671875,36],"p":null,"di":true,"pi":false,"fab":false,"dc":[605.328125,668],"pc":null,"y0":0.933,"row":1.394,"z":1},{"k":"chips","role":"other","d":[605.328125,704,110.671875,16],"p":null,"di":true,"pi":false,"fab":false,"dc":[605.328125,704],"pc":null,"y0":0.983,"row":1.439,"z":1},{"k":"title","role":"other","d":[740,20,267.1875,27.1875],"p":null,"di":true,"pi":false,"fab":false,"dc":[740,20],"pc":null,"y0":0.033,"row":0,"z":1},{"k":"entity","role":"other","d":[740,47.1875,133.59375,68.0],"p":null,"di":true,"pi":false,"fab":false,"dc":[740,47.1875],"pc":null,"y0":0.071,"row":0,"z":1},{"k":"entity","role":"other","d":[873.59375,47.1875,133.59375,68.0],"p":null,"di":true,"pi":false,"fab":false,"dc":[873.59375,47.1875],"pc":null,"y0":0.071,"row":0,"z":1},{"k":"lock","role":"other","d":[740,115.1875,267.1875,124.0],"p":null,"di":true,"pi":false,"fab":false,"dc":[740,115.1875],"pc":null,"y0":0.166,"row":0,"z":1},{"k":"button","role":"other","d":[740,239.1875,133.59375,68.0],"p":null,"di":true,"pi":false,"fab":false,"dc":[740,239.1875],"pc":null,"y0":0.338,"row":0,"z":1},{"k":"button","role":"other","d":[873.59375,239.1875,133.59375,68.0],"p":null,"di":true,"pi":false,"fab":false,"dc":[873.59375,239.1875],"pc":null,"y0":0.338,"row":0,"z":1},{"k":"title","role":"other","d":[740,307.1875,267.1875,27.1875],"p":null,"di":true,"pi":false,"fab":false,"dc":[740,307.1875],"pc":null,"y0":0.432,"row":0,"z":1},{"k":"air-quality","role":"other","d":[740,334.375,267.1875,76.984375],"p":[359,160,382,44],"di":true,"pi":true,"fab":false,"dc":[740,334.375],"pc":[4,160],"y0":0.47,"row":0.228,"z":1},{"k":"sensor","role":"other","d":[740,411.359375,133.59375,60.0],"p":[359,204,191,44],"di":true,"pi":true,"fab":false,"dc":[740,411.359375],"pc":[4,204],"y0":0.577,"row":0.289,"z":1},{"k":"sensor","role":"other","d":[873.59375,411.359375,133.59375,60.0],"p":[550,204,191,44],"di":true,"pi":true,"fab":false,"dc":[873.59375,411.359375],"pc":[195,204],"y0":0.577,"row":0.289,"z":1},{"k":"climate","role":"other","d":[740,471.359375,267.1875,66.0],"p":null,"di":true,"pi":false,"fab":false,"dc":[740,471.359375],"pc":null,"y0":0.66,"row":0,"z":1},{"k":"fab-sheet","role":"other","d":[740,537.359375,267.1875,60.0],"p":null,"di":true,"pi":false,"fab":false,"dc":[740,537.359375],"pc":null,"y0":0.752,"row":0,"z":1},{"k":"bar","role":"other","d":null,"p":[359,248,382,60],"di":false,"pi":true,"fab":false,"dc":null,"pc":[4,248],"y0":0.35,"row":0.35,"z":1},{"k":"bar","role":"other","d":null,"p":[359,308,382,60],"di":false,"pi":true,"fab":false,"dc":null,"pc":[4,308],"y0":0.433,"row":0.433,"z":1},{"k":"fab","role":"phone","y0":1,"row":1,"d":null,"p":[655,622,84,84],"di":false,"pi":true,"fab":true,"dc":null,"pc":[300,622],"z":2},{"k":"fab","role":"phone","y0":1,"row":1,"d":null,"p":[671,562,68,68],"di":false,"pi":true,"fab":true,"dc":null,"pc":[316,562],"z":2}]}}, META = {"stage":[1100,720],"frame":{"d":[0,0,1100,720],"p":[355,0,390,720]},"sprite":{"d":1.5,"p":2.0},"fabTop":526};
  var HOLD = 2.5, MOVE = 1.8, CYCLE = 2 * (HOLD + MOVE);
  /* The move is one script, played forwards to the phone and backwards to the desktop (s = seconds into the script):
     the resting capture and the far cards fade together, the frame narrows and the centre column settles, the phone's far cards arrive row by row. */
  var HOLD_FADE = 0.36, OUT_END = 0.44, FRAME_START = 0.26, FRAME_END = 1.22, CENTRE_START = 0.16, CENTRE_LEN = 0.96, ARRIVE_START = 0.74, ARRIVE_SPREAD = 0.3, ARRIVE_LEN = 0.5;
  var F = META.frame, SW = META.stage[0], SH = META.stage[1], R = 30;

  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* Position in the loop: f = 0 desktop, f = 1 phone; age = seconds into the current move, dir = +1 to phone. */
  function phase(t) {
    t = ((t % CYCLE) + CYCLE) % CYCLE;
    if (t < HOLD) return { hold: 0 };
    if (t < HOLD + MOVE) return { age: t - HOLD, dir: 1 };
    if (t < 2 * HOLD + MOVE) return { hold: 1 };
    return { age: t - 2 * HOLD - MOVE, dir: -1 };
  }

  function el(parent, cls, css) {
    var e = document.createElement("div");
    e.className = cls;
    if (css) e.style.cssText = css;
    parent.appendChild(e);
    return e;
  }

  function Morph(root) {
    var lang = root.getAttribute("data-lang") || "en";
    var base = (root.getAttribute("data-assets") || "assets") + "/" + lang + "/";
    this.root = root;
    this.stage = el(root, "lm-stage");
    var st = this.stage;
    function src(name) { return base + name + ".webp"; }
    /* Every picture is drawn once into its own canvas: nothing is left for the browser to decode in the middle of the move. */
    var jobs = [];
    function canvas(cls, w, h, name, sx, sy, sw, sh) {
      var e = document.createElement("canvas");
      e.className = cls; e.width = Math.ceil(sw); e.height = Math.ceil(sh);
      e.style.width = w + "px"; e.style.height = h + "px";
      st.appendChild(e);
      jobs.push({ e: e, name: name, sx: sx, sy: sy, sw: sw, sh: sh });
      return e;
    }
    function layer(r, crop, name, s) { return canvas("lm-layer", r[2], r[3], name, crop[0] * s, crop[1] * s, r[2] * s, r[3] * s); }
    function picture(cls, rect, name, s) { var e = canvas(cls, rect[2], rect[3], name, 0, 0, rect[2] * s, rect[3] * s); e.style.left = "0"; e.style.top = "0"; return e; }

    this.skyD = picture("lm-sky", F.d, "d-sky", 0.5);
    this.skyP = picture("lm-sky", F.p, "p-sky", 0.5);

    var self = this;
    this.cards = DATA[lang].cards.map(function (c) {
      var o = { c: c };
      if (c.d && c.di) o.ea = layer(c.d, c.dc, "d-cards", META.sprite.d);
      if (c.p && c.pi) {
        if (c.fab) o.eb = layer(c.p, [c.pc[0], c.pc[1] - META.fabTop], "p-fabs", META.sprite.p);
        else o.eb = layer(c.p, c.pc, "p-cards", META.sprite.p);
      }
      return o;
    });
    this.holdD = picture("lm-hold", F.d, "d-hold", 1.5);
    this.holdP = picture("lm-hold", F.p, "p-hold", 2);
    this.holdD.style.transform = "translate(" + F.d[0] + "px," + F.d[1] + "px)";
    this.holdP.style.transform = "translate(" + F.p[0] + "px," + F.p[1] + "px)";

    this.barT = el(st, "lm-bar"); this.barB = el(st, "lm-bar"); this.barL = el(st, "lm-bar"); this.barR = el(st, "lm-bar");
    this.lines = ["h", "h", "v", "v"].map(function (k) { return el(st, "lm-line lm-" + k); });
    this.corners = [0, 1, 2, 3].map(function (i) {
      var c = el(st, "lm-corner");
      c.innerHTML = '<svg width="' + R + '" height="' + R + '" viewBox="0 0 ' + R + " " + R + '"><path d="M0 0H' + R + "A" + R + " " + R + " 0 0 0 0 " + R + 'Z"/><path d="M' + R + " 0.75A" + (R - 0.75) + " " + (R - 0.75) + " 0 0 0 0.75 " + R + '"/></svg>';
      c.dataset.rot = i * 90;
      return c;
    });

    this.resize = this.resize.bind(this);
    this.tick = this.tick.bind(this);
    this.resize();
    if (window.ResizeObserver) new ResizeObserver(this.resize).observe(root);
    else window.addEventListener("resize", this.resize);
    var images = {};
    this.ready = Promise.all(["d-sky", "p-sky", "d-cards", "p-cards", "p-fabs", "d-hold", "p-hold"].map(function (n) {
      return new Promise(function (ok) { var i = new Image(); images[n] = i; i.onload = i.onerror = function () { (i.decode ? i.decode().catch(function () {}) : Promise.resolve()).then(ok); }; i.src = src(n); });
    })).then(function () {
      jobs.forEach(function (j) { var i = images[j.name]; if (i.naturalWidth) j.e.getContext("2d").drawImage(i, j.sx, j.sy, j.sw, j.sh, 0, 0, j.e.width, j.e.height); });
      root.classList.add("lm-ready");
    });

    this.seek(0);
    this.visible = true;
    this.staticMode = matchMedia("(prefers-reduced-motion: reduce)").matches || root.hasAttribute("data-static");
    if (this.staticMode) return this.initStatic();
    if (root.hasAttribute("data-manual")) return;
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (es) { self.visible = es[0].isIntersecting; self.play(); }).observe(root);
    }
    document.addEventListener("visibilitychange", function () { self.play(); });
    this.ready.then(function () { self.started = true; self.play(); });
  }

  Morph.prototype.resize = function () {
    var w = this.root.clientWidth || SW;
    this.stage.style.transform = "scale(" + w / SW + ")";
  };

  Morph.prototype.play = function () {
    var run = this.started && this.visible && !document.hidden;
    if (run && !this.raf) { this.t0 = performance.now() - (this.pos || 0) * 1000; this.raf = requestAnimationFrame(this.tick); }
    if (!run && this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
  };

  Morph.prototype.tick = function (now) {
    this.pos = (now - this.t0) / 1000;
    this.seek(this.pos);
    this.raf = requestAnimationFrame(this.tick);
  };

  /* Draw any moment of the loop: a pure function of t, so the README loop renders frame by frame. */
  Morph.prototype.seek = function (t) {
    var ph = phase(t), i, o, fp, moving = ph.hold === undefined;
    if (!moving && this.rest === ph.hold) return;
    this.rest = moving ? undefined : ph.hold;
    /* At rest the script simply stands at its first or last moment, under the opaque capture. */
    var sc = !moving ? ph.hold * MOVE : ph.dir > 0 ? ph.age : MOVE - ph.age;
    fp = ease(clamp((sc - FRAME_START) / (FRAME_END - FRAME_START)));
    /* Frame */
    var fx = lerp(F.d[0], F.p[0], fp), fy = lerp(F.d[1], F.p[1], fp), fw = lerp(F.d[2], F.p[2], fp), fh = lerp(F.d[3], F.p[3], fp);
    this.barT.style.transform = "translateY(" + (fy - SH) + "px)";
    this.barB.style.transform = "translateY(" + (fy + fh) + "px)";
    this.barL.style.transform = "translateX(" + (fx - SW) + "px)";
    this.barR.style.transform = "translateX(" + (fx + fw) + "px)";
    var l = this.lines;
    l[0].style.transform = "translate(" + (fx + R) + "px," + fy + "px) scaleX(" + (fw - 2 * R) + ")";
    l[1].style.transform = "translate(" + (fx + R) + "px," + (fy + fh - 1.5) + "px) scaleX(" + (fw - 2 * R) + ")";
    l[2].style.transform = "translate(" + fx + "px," + (fy + R) + "px) scaleY(" + (fh - 2 * R) + ")";
    l[3].style.transform = "translate(" + (fx + fw - 1.5) + "px," + (fy + R) + "px) scaleY(" + (fh - 2 * R) + ")";
    var c = this.corners;
    c[0].style.transform = "translate(" + fx + "px," + fy + "px)";
    c[1].style.transform = "translate(" + (fx + fw - R) + "px," + fy + "px) rotate(90deg)";
    c[2].style.transform = "translate(" + (fx + fw - R) + "px," + (fy + fh - R) + "px) rotate(180deg)";
    c[3].style.transform = "translate(" + fx + "px," + (fy + fh - R) + "px) rotate(270deg)";
    /* The sky covers the frame; both skies are only soft colour, so they pass into each other unseen. */
    var cover = function (e, w, h) { var k = Math.max(fw / w, fh / h); e.style.transform = "translate(" + (fx + fw / 2 - w * k / 2) + "px," + (fy + fh / 2 - h * k / 2) + "px) scale(" + k + ")"; };
    cover(this.skyD, F.d[2], F.d[3]);
    cover(this.skyP, F.p[2], F.p[3]);
    this.skyP.style.opacity = smooth(0.2, 0.85, fp);
    /* Full captures rest at both ends and pass slowly to the moving layers, with stars and moon. */
    this.holdD.style.opacity = 1 - smooth(0, HOLD_FADE, sc);
    this.holdP.style.opacity = smooth(MOVE - HOLD_FADE, MOVE, sc);
    /* Cards */
    for (i = 0; i < this.cards.length; i++) {
      o = this.cards[i];
      var c = o.c;
      if (c.role === "centre") {
        var q = ease(clamp((sc - CENTRE_START - c.y0 * 0.12) / CENTRE_LEN));
        var X = lerp(c.d[0], c.p[0], q), Y = lerp(c.d[1], c.p[1], q), W = lerp(c.d[2], c.p[2], q), H = lerp(c.d[3], c.p[3], q);
        /* The phone's crop fades in over the desktop's, then the desktop's goes: the card never thins out on the way. */
        place(o.ea, c.d, X, Y, W, H, 1 - smooth(0.5, 0.64, q));
        place(o.eb, c.p, X, Y, W, H, smooth(0.36, 0.5, q));
        continue;
      }
      if (o.ea) {
        /* Leaving: exactly in place, so it matches the resting capture it fades with; no doubled text. */
        var k = smooth(0, 1, clamp(sc / OUT_END));
        place(o.ea, c.d, c.d[0], c.d[1], c.d[2], c.d[3], 1 - k);
      }
      if (o.eb) {
        /* Arriving: as one group, row by row from the top. */
        var a = clamp((sc - ARRIVE_START - c.row * ARRIVE_SPREAD) / ARRIVE_LEN), e = 1 - Math.pow(1 - a, 3);
        var from = c.d ? (c.d[0] + c.d[2] / 2 < SW / 2 ? -18 : 18) : 0;
        var grow = c.fab ? 0.7 + 0.3 * e : 1;
        place(o.eb, c.p, c.p[0] + from * (1 - e) + c.p[2] * (1 - grow) / 2, c.p[1] + 12 * (1 - e) + c.p[3] * (1 - grow) / 2, c.p[2] * grow, c.p[3] * grow, smooth(0, 0.7, a));
      }
    }
  };

  function place(e, own, X, Y, W, H, op) {
    if (!e) return;
    /* Never quite 0: the layer stays ready on the graphics card and shows at once. */
    e.style.opacity = op < 0.004 ? 0.004 : op;
    e.style.transform = "translate(" + X + "px," + Y + "px) scale(" + W / own[2] + "," + H / own[3] + ")";
  }

  /* Reduced motion: one still at a time and a manual toggle. */
  Morph.prototype.initStatic = function () {
    var self = this, bar = document.createElement("div");
    bar.className = "lm-toggle";
    (this.root.getAttribute("data-lang") === "pl" ? [["Komputer", 0], ["Telefon", 1]] : [["Desktop", 0], ["Phone", 1]]).forEach(function (b) {
      var btn = document.createElement("button");
      btn.type = "button"; btn.textContent = b[0];
      btn.onclick = function () { self.seek(b[1] ? HOLD + MOVE + 0.1 : 0.1); [].forEach.call(bar.children, function (k) { k.setAttribute("aria-pressed", k === btn); }); };
      btn.setAttribute("aria-pressed", !b[1]);
      bar.appendChild(btn);
    });
    this.root.appendChild(bar);
    this.seek(0.1);
  };

  function init() {
    window.lumenMorph = [].map.call(document.querySelectorAll(".lumen-morph"), function (r) { return new Morph(r); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.LUMEN_MORPH_TIMING = { HOLD: HOLD, MOVE: MOVE, CYCLE: CYCLE };
})();
