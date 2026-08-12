const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = __dirname;
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "physics-question-bank-data.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "visual-concept-registry.js"), "utf8"), context);

const bank = context.window.QUESTION_BANK;
const registry = context.window.visualConceptRegistry;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertTag(tag, label) {
  const questions = bank.filter(question => (question.visualTags || []).includes(tag));
  assert(questions.length > 0, `${label}: no tagged questions`);
  assert(registry[tag], `${label}: registry entry missing`);
  assert(registry[tag].filePath, `${label}: visual path missing`);
  const localPath = registry[tag].filePath.split(/[?#]/)[0];
  assert(fs.existsSync(path.join(root, localPath)), `${label}: visual file not found: ${localPath}`);
}

assertTag("mri-chemical-shift", "MRI chemical shift");
assertTag("mri-magnetisation-recovery", "MRI magnetisation recovery");
assertTag("ct-pitch-dose", "CT pitch and dose");
assertTag("doppler-angle", "Doppler angle");
assertTag("pet-coincidence", "PET coincidence");
assertTag("gamma-camera-collimator", "Gamma camera collimator");
assertTag("mri-larmor-precession", "MRI Larmor precession");
assertTag("mri-b0-precession-rf-recovery-overview", "MRI six-stage overview");
assertTag("mri-rf-excitation", "MRI RF excitation");
assertTag("mri-refocusing", "MRI refocusing");
assertTag("mri-dephasing", "MRI dephasing");
assertTag("mri-t2-t2star-signal", "MRI T2 and T2 star signal");
assertTag("mri-t2-dephasing-spin-echo", "MRI T2 dephasing and spin echo");
assertTag("mri-dephasing-step-sequence", "MRI dephasing export sequence");
assertTag("mri-gradients-kspace", "MRI gradients and k-space");
assertTag("mri-artifacts", "MRI artefacts");
assertTag("radiographic-magnification", "Radiographic magnification");
assertTag("xray-focal-spot-unsharpness", "X-ray focal spot and unsharpness");
assertTag("xray-guided-interactions", "X-ray guided interactions");
assertTag("line-focus-principle", "Line focus principle");
assertTag("beam-divergence-isocentre", "Beam divergence and isocentre");
assertTag("digital-breast-tomosynthesis", "Digital breast tomosynthesis");
assertTag("mri-tissue-signal", "MRI tissue signal");
assertTag("wave-frequency-period", "Wave frequency and period");

for (const question of bank) {
  for (const tag of question.visualTags || []) {
    assert(registry[tag], `Unknown visual tag '${tag}' on question ${question.id}`);
  }
}

for (const [tag, entry] of Object.entries(registry)) {
  if (!entry.filePath) continue;
  const localPath = entry.filePath.split(/[?#]/)[0];
  assert(fs.existsSync(path.join(root, localPath)), `Registry file missing for ${tag}: ${localPath}`);
}

const legislationQuestions = bank.filter(question => (question.visualTags || []).includes("irmer-irr"));
assert(legislationQuestions.length > 0, "No legislation questions were tagged");
assert(registry["irmer-irr"].filePath === null, "Legislation questions must not show an unrelated visual");

console.log(`PASS: ${bank.length} questions checked against ${Object.keys(registry).length} visual concepts.`);
