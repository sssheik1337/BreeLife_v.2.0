import {
    applyCaloriesSafetyClamp,
    calculateAge,
    calculateBMR,
    calculateMacros,
    calculateTDEE,
    calculateWeightGoalForecast,
    clamp,
    computeTargets,
    resolveAdaptiveRateLimit,
    validateGoalWeightConsistency,
    adjustCaloriesByWeeklyProgress
} from '../core/calculations';

type NormalizeLocalDateFn = (value: string) => string | null;

export interface LegacyCalculationsBindings {
    calculateAge: (birthDate: unknown) => number | null;
    calculateBMR: (payload: unknown) => number | null;
    calculateTDEE: (bmr: unknown, activityFactor: unknown) => number | null;
    clamp: (value: number, min: number, max: number) => number;
    validateGoalWeightConsistency: (
        goal: unknown,
        currentWeight: unknown,
        targetWeight: unknown,
        goalDeadline?: string | null
    ) => Record<string, unknown>;
    resolveAdaptiveRateLimit: (goal: unknown, weightKg: unknown) => number | null;
    applyCaloriesSafetyClamp: (caloriesTarget: unknown, sex: unknown) => number | null;
    adjustCaloriesByWeeklyProgress: (profile: unknown, weeklyAverageWeight: unknown) => Record<string, unknown>;
    calculateMacros: (payload: unknown) => Record<string, unknown> | null;
    calculateWeightGoalForecast: (payload: unknown) => Record<string, unknown>;
    computeTargets: (profile: unknown, nowDate?: unknown) => Record<string, unknown>;
    calculations: Record<string, unknown>;
}

declare global {
    interface Window {
        __SPA_CALCULATIONS__?: LegacyCalculationsBindings;
        appDebug?: boolean;
        normalizeLocalDate?: NormalizeLocalDateFn;
        calculateAge?: (birthDate: unknown) => number | null;
        calculateBMR?: (payload: unknown) => number | null;
        calculateTDEE?: (bmr: unknown, activityFactor: unknown) => number | null;
        clamp?: (value: number, min: number, max: number) => number;
        validateGoalWeightConsistency?: (
            goal: unknown,
            currentWeight: unknown,
            targetWeight: unknown,
            goalDeadline?: string | null
        ) => Record<string, unknown>;
        resolveAdaptiveRateLimit?: (goal: unknown, weightKg: unknown) => number | null;
        applyCaloriesSafetyClamp?: (caloriesTarget: unknown, sex: unknown) => number | null;
        adjustCaloriesByWeeklyProgress?: (profile: unknown, weeklyAverageWeight: unknown) => Record<string, unknown>;
        calculateMacros?: (payload: unknown) => Record<string, unknown> | null;
        calculateWeightGoalForecast?: (payload: unknown) => Record<string, unknown>;
        computeTargets?: (profile: unknown, nowDate?: unknown) => Record<string, unknown>;
        calculations?: Record<string, unknown>;
    }
}

const resolveDependencies = (targetWindow: Window) => ({
    debug: targetWindow.appDebug === true,
    normalizeLocalDate: typeof targetWindow.normalizeLocalDate === 'function'
        ? targetWindow.normalizeLocalDate
        : undefined
});

export const createCalculationsBindings = (targetWindow: Window = window): LegacyCalculationsBindings => {
    const calculateAgeBridge = (birthDate: unknown): number | null =>
        calculateAge(birthDate, resolveDependencies(targetWindow));
    const calculateWeightGoalForecastBridge = (payload: unknown): Record<string, unknown> =>
        calculateWeightGoalForecast(payload as Record<string, unknown>, resolveDependencies(targetWindow));
    const adjustCaloriesByWeeklyProgressBridge = (
        profile: unknown,
        weeklyAverageWeight: unknown
    ): Record<string, unknown> =>
        adjustCaloriesByWeeklyProgress(
            profile as Record<string, unknown>,
            weeklyAverageWeight as Record<string, unknown>,
            resolveDependencies(targetWindow)
        );
    const computeTargetsBridge = (profile: unknown, nowDate?: unknown): Record<string, unknown> =>
        computeTargets(profile as Record<string, unknown>, nowDate as Date | string | null, resolveDependencies(targetWindow));

    const calculationsObject: Record<string, unknown> = {
        calculateAge: calculateAgeBridge,
        calculateBMR,
        calculateTDEE,
        clamp,
        validateGoalWeightConsistency,
        resolveAdaptiveRateLimit,
        applyCaloriesSafetyClamp,
        adjustCaloriesByWeeklyProgress: adjustCaloriesByWeeklyProgressBridge,
        calculateMacros,
        calculateWeightGoalForecast: calculateWeightGoalForecastBridge,
        computeTargets: computeTargetsBridge
    };

    return {
        calculateAge: calculateAgeBridge,
        calculateBMR: calculateBMR as (payload: unknown) => number | null,
        calculateTDEE,
        clamp,
        validateGoalWeightConsistency,
        resolveAdaptiveRateLimit,
        applyCaloriesSafetyClamp,
        adjustCaloriesByWeeklyProgress: adjustCaloriesByWeeklyProgressBridge,
        calculateMacros: calculateMacros as (payload: unknown) => Record<string, unknown> | null,
        calculateWeightGoalForecast: calculateWeightGoalForecastBridge,
        computeTargets: computeTargetsBridge,
        calculations: calculationsObject
    };
};

export const installCalculationsBridge = (targetWindow: Window = window): LegacyCalculationsBindings => {
    const bindings = createCalculationsBindings(targetWindow);

    targetWindow.__SPA_CALCULATIONS__ = bindings;
    targetWindow.calculateAge = bindings.calculateAge;
    targetWindow.calculateBMR = bindings.calculateBMR;
    targetWindow.calculateTDEE = bindings.calculateTDEE;
    targetWindow.clamp = bindings.clamp;
    targetWindow.validateGoalWeightConsistency = bindings.validateGoalWeightConsistency;
    targetWindow.resolveAdaptiveRateLimit = bindings.resolveAdaptiveRateLimit;
    targetWindow.applyCaloriesSafetyClamp = bindings.applyCaloriesSafetyClamp;
    targetWindow.adjustCaloriesByWeeklyProgress = bindings.adjustCaloriesByWeeklyProgress;
    targetWindow.calculateMacros = bindings.calculateMacros;
    targetWindow.calculateWeightGoalForecast = bindings.calculateWeightGoalForecast;
    targetWindow.computeTargets = bindings.computeTargets;
    targetWindow.calculations = bindings.calculations;

    return bindings;
};
