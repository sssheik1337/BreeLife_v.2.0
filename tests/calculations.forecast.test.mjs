import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const calculationsPath = path.resolve(__dirname, '../static/js/calculations.js');
const calculationsCode = fs.readFileSync(calculationsPath, 'utf8');

const context = {
    console,
    Date,
    Math,
    Number
};

vm.createContext(context);
vm.runInContext(calculationsCode, context);

const calculateWeightGoalForecast = context.calculateWeightGoalForecast;

function isoDateAfterDays(days) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

function assertNoNaN(result) {
    const numericKeys = Object.keys(result).filter((key) => result[key] !== null && typeof result[key] === 'number');
    for (const key of numericKeys) {
        assert.equal(Number.isNaN(result[key]), false, `Поле ${key} не должно быть NaN`);
        assert.equal(Number.isFinite(result[key]), true, `Поле ${key} должно быть конечным числом`);
    }
}

function assertDateIsPossible(result) {
    if (result.predicted_goal_date === null) {
        return;
    }
    const timestamp = new Date(`${result.predicted_goal_date}T00:00:00`).getTime();
    assert.equal(Number.isNaN(timestamp), false, 'Дата цели должна быть валидной');
}

function assertRateConsistency(result) {
    if (result.calorie_delta !== null && result.calorie_delta !== 0) {
        assert.notEqual(result.weight_rate_kg_per_week, 0, 'Темп не должен быть нулевым при ненулевом calorie_delta');
    }
}

test('60 кг → lose 5 кг: устойчивые расчёты без NaN и отрицательных калорий', () => {
    const result = calculateWeightGoalForecast({
        sex: 'female',
        goal: 'lose',
        tdee_calories: 2000,
        weight_kg: 60,
        target_weight_kg: 55,
        goal_deadline: isoDateAfterDays(120)
    });

    assert.equal(result.error, null);
    assert.equal(result.calories_target >= 1200, true, 'Калории не должны быть ниже безопасной границы');
    assert.equal(result.weight_rate_kg_per_week < 0, true, 'Для снижения веса темп должен быть отрицательным');

    assertNoNaN(result);
    assertDateIsPossible(result);
    assertRateConsistency(result);
});

test('120 кг → lose 20 кг: нет отрицательных калорий и невозможных дат', () => {
    const result = calculateWeightGoalForecast({
        sex: 'male',
        goal: 'lose',
        tdee_calories: 2800,
        weight_kg: 120,
        target_weight_kg: 100,
        goal_deadline: isoDateAfterDays(210)
    });

    assert.equal(result.error, null);
    assert.equal(result.calories_target >= 1500, true, 'Калории не должны быть ниже безопасной границы');
    assert.equal(result.weight_rate_kg_per_week < 0, true, 'Для снижения веса темп должен быть отрицательным');

    assertNoNaN(result);
    assertDateIsPossible(result);
    assertRateConsistency(result);
});

test('55 кг → gain 5 кг: корректный профицит и валидная дата прогноза', () => {
    const result = calculateWeightGoalForecast({
        sex: 'female',
        goal: 'gain',
        tdee_calories: 1800,
        weight_kg: 55,
        target_weight_kg: 60,
        goal_deadline: isoDateAfterDays(140)
    });

    assert.equal(result.error, null);
    assert.equal(result.calories_target > 0, true, 'Целевые калории должны быть положительными');
    assert.equal(result.weight_rate_kg_per_week > 0, true, 'Для набора веса темп должен быть положительным');

    assertNoNaN(result);
    assertDateIsPossible(result);
    assertRateConsistency(result);
});

test('maintain: полностью изолированный режим без дедлайна и расчётов delta/rate', () => {
    const result = calculateWeightGoalForecast({
        sex: 'male',
        goal: 'maintain',
        tdee_calories: 2400,
        weight_kg: 80,
        target_weight_kg: 70,
        goal_deadline: isoDateAfterDays(7)
    });

    assert.equal(result.error, null);
    assert.equal(result.calories_target, 2400);
    assert.equal(result.calorie_delta, 0);
    assert.equal(result.weight_rate_kg_per_week, 0);
    assert.equal(result.predicted_goal_date, null);
    assert.equal(result.safe_weeks_estimate, null);
    assert.equal(result.warning_message, null, 'Дедлайн в режиме maintain должен игнорироваться');

    assertNoNaN(result);
    assertDateIsPossible(result);
});

test('дедлайн слишком агрессивный: дедлайн не управляет темпом и калориями', () => {
    const baseResult = calculateWeightGoalForecast({
        sex: 'male',
        goal: 'lose',
        tdee_calories: 2800,
        weight_kg: 120,
        target_weight_kg: 100,
        goal_deadline: null
    });

    const result = calculateWeightGoalForecast({
        sex: 'male',
        goal: 'lose',
        tdee_calories: 2800,
        weight_kg: 120,
        target_weight_kg: 100,
        goal_deadline: isoDateAfterDays(21)
    });

    assert.equal(result.error, null);
    assert.equal(typeof result.warning_message, 'string');
    assert.match(result.warning_message, /недостижима при безопасном темпе/i);
    assert.equal(Number.isFinite(result.safe_weeks_estimate), true, 'Должна рассчитываться безопасная оценка недель');

    assert.equal(result.calorie_delta, baseResult.calorie_delta, 'Дедлайн не должен менять calorie_delta');
    assert.equal(result.calories_target, baseResult.calories_target, 'Дедлайн не должен менять calories_target');
    assert.equal(result.weight_rate_kg_per_week, baseResult.weight_rate_kg_per_week, 'Дедлайн не должен менять темп');

    assert.equal(result.required_rate_kg_per_week, null);
    assert.equal(result.required_calorie_delta, null);
    assert.equal(result.required_calories_target, null);

    assertNoNaN(result);
    assertDateIsPossible(result);
    assertRateConsistency(result);
});
