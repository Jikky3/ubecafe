import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalHeading, cleanOcrText, fitWithin, hasReadableText, overallProgress, MAX_PIXELS, MAX_SIDE, OCR_SOURCES,
} from '../js/engines/ocr.js';
import { RecipeParser } from '../js/engines/recipe-parser.js';

test('fitWithin leaves small images alone', () => {
  assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600, scale: 1 });
});

test('fitWithin caps the longest side', () => {
  const { width, height, scale } = fitWithin(4800, 1200);
  assert.equal(width, MAX_SIDE);
  assert.equal(height, 600);
  assert.equal(scale, 0.5);
});

test('fitWithin caps the total pixel count and keeps the aspect ratio', () => {
  const { width, height } = fitWithin(2400, 2400);
  assert.ok(width * height <= MAX_PIXELS * 1.001);
  assert.equal(width, height);
  const tall = fitWithin(3000, 4000);
  assert.ok(tall.width * tall.height <= MAX_PIXELS * 1.001);
  assert.ok(Math.abs(tall.width / tall.height - 0.75) < 0.01);
});

test('fitWithin handles bad input', () => {
  assert.deepEqual(fitWithin(0, 100), { width: 0, height: 0, scale: 0 });
  assert.deepEqual(fitWithin(NaN, 100), { width: 0, height: 0, scale: 0 });
  assert.equal(fitWithin(100000, 1).height, 1);
});

test('overallProgress maps Tesseract phases onto one increasing bar', () => {
  assert.equal(overallProgress('loading tesseract core', 0).percent, 5);
  assert.equal(overallProgress('loading language traineddata', 1).percent, 70);
  assert.equal(overallProgress('loading language traineddata (from cache)', 0.5).percent, 55);
  assert.equal(overallProgress('recognizing text', 0.5).percent, 88);
  assert.equal(overallProgress('recognizing text', 1).percent, 100);
  assert.equal(overallProgress('recognizing text', 7).percent, 100);
  assert.equal(overallProgress('something new', 0.5), null);
  assert.equal(overallProgress(undefined, 0.5), null);
});

test('canonicalHeading recognizes noisy heading variants', () => {
  assert.equal(canonicalHeading('INGREDIENTS'), 'Ingredients:');
  assert.equal(canonicalHeading('~Ingredients .'), 'Ingredients:');
  assert.equal(canonicalHeading('For the ingredients:'), 'Ingredients:');
  assert.equal(canonicalHeading('You’ll need'), 'Ingredients:');
  assert.equal(canonicalHeading('METHOD'), 'Instructions:');
  assert.equal(canonicalHeading('Directions —'), 'Instructions:');
  assert.equal(canonicalHeading('How to make it'), 'Instructions:');
  assert.equal(canonicalHeading('Ingredients are fresh'), null);
});

test('cleanOcrText normalizes bullets, misread ones and stray edge characters', () => {
  const raw = [
    '| Oat Pancakes',
    'INGREDIENTS',
    '• 1 cup rolled oats',
    'e 2 eggs',
    'l cup milk',
    '© I tbsp honey',
    '» 1 / 2 tsp cinnamon',
    '1O0 g blueberries |',
    '.',
    '—',
  ].join('\n');
  assert.equal(cleanOcrText(raw), [
    'Oat Pancakes',
    'Ingredients:',
    '- 1 cup rolled oats',
    '- 2 eggs',
    '1 cup milk',
    '- 1 tbsp honey',
    '- 1/2 tsp cinnamon',
    '100 g blueberries',
  ].join('\n'));
});

test('cleanOcrText fixes ligatures, quotes and dashes', () => {
  assert.equal(cleanOcrText('Fluﬀy “Waffles” — ﬁne'), 'Fluffy "Waffles" - fine');
});

test('cleanOcrText re-joins wrapped instructions and hyphenated words', () => {
  const raw = [
    'Method',
    '1. Massage the kale with the oil and the',
    'juice of the lemon until it softens.',
    '2. Simmer for 5 min-',
    'utes, then serve.',
    '3. Enjoy.',
  ].join('\n');
  assert.equal(cleanOcrText(raw), [
    'Instructions:',
    '1. Massage the kale with the oil and the juice of the lemon until it softens.',
    '2. Simmer for 5 minutes, then serve.',
    '3. Enjoy.',
  ].join('\n'));
});

test('cleanOcrText joins wrapped ingredients but keeps separate lowercase items', () => {
  const raw = [
    'Ingredients',
    '1 can chickpeas, drained and',
    'rinsed',
    'salt and pepper',
    '2 cups kale',
  ].join('\n');
  assert.equal(cleanOcrText(raw), [
    'Ingredients:',
    '1 can chickpeas, drained and rinsed',
    'salt and pepper',
    '2 cups kale',
  ].join('\n'));
});

test('cleanOcrText does not merge title-area lines', () => {
  assert.equal(cleanOcrText('Green Smoothie\nby Ana\nServes 2'), 'Green Smoothie\nby Ana\nServes 2');
});

test('cleaned OCR text parses into a recipe', () => {
  const raw = [
    'Kale & Chickpea Power Salad',
    'Serves 2',
    'INGREDIENTS',
    '« 3 cups kale',
    '« 1 can chickpeas, drained',
    'e 1/2 cup quinoa',
    'METHOD',
    '1. Cook the quinoa and let it',
    'cool.',
    '2. Toss everything together.',
  ].join('\n');
  const parsed = RecipeParser.parseRecipeText(cleanOcrText(raw));
  assert.equal(parsed.title, 'Kale & Chickpea Power Salad');
  assert.equal(parsed.servings, 2);
  assert.deepEqual(parsed.ingredientsText.split('\n'), ['3 cups kale', '1 can chickpeas, drained', '1/2 cup quinoa']);
  assert.deepEqual(parsed.instructions.split('\n'), ['Cook the quinoa and let it cool.', 'Toss everything together.']);
});

test('hasReadableText rejects noise', () => {
  assert.equal(hasReadableText(''), false);
  assert.equal(hasReadableText('~ | .. 1 2'), false);
  assert.equal(hasReadableText('Ingredients:\n1 cup oats'), true);
});

test('OCR sources are exact pinned versions on jsDelivr', () => {
  for (const key of ['script', 'workerPath', 'corePath', 'langPath']) {
    assert.match(OCR_SOURCES[key], /^https:\/\/cdn\.jsdelivr\.net\/npm\/[^/]*@\d+\.\d+\.\d+(?:\/|$)|^https:\/\/cdn\.jsdelivr\.net\/npm\/@[^/]+\/[^@/]+@\d+\.\d+\.\d+\//);
  }
  assert.match(OCR_SOURCES.integrity, /^sha384-[A-Za-z0-9+/]{64}$/);
});
