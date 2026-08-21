/**
 * Production-ready Rule-Based Calendar (RBC) engine for TypeScript.
 *
 * Scope implemented from the provided RBC semantics:
 * - Specific dates
 * - Weekday rules
 * - Monthday rules
 * - Advanced combination of months + weekdays + monthdays
 * - Base calendar-aware execution rules
 * - Confirmation calendar + exception policy + shift-by
 * - Activity period filtering
 *
 * Important assumptions:
 * - Week starts on Monday.
 * - D/-D/L/-L rules are evaluated against working days when a base calendar is supplied.
 *   Without a base calendar, plain date semantics are used.
 * - Exclusion rules always override inclusion rules.
 * - Periodic calendar variants such as D3PA / L3PA are intentionally not implemented.
 *   If you need periodic calendar support later, that should be added explicitly with a separate
 *   period model instead of overloading regular-calendar logic.
 */
export class ScheduleValidationError extends Error {
    details;
    constructor(message, details = []) {
        super(message);
        this.name = 'ScheduleValidationError';
        this.details = details;
    }
}
const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const VALID_MONTHS = new Set([...MONTH_NAMES, 'ALL']);
const VALID_WEEK_MONTH_RELATIONS = new Set(['AND', 'OR']);
const VALID_ACTIVITY_MODES = new Set(['ALWAYS', 'ACTIVE', 'NOT_ACTIVE']);
const VALID_EXCEPTION_POLICIES = new Set([
    'DISABLE_RUN',
    'RUN_ON_NEXT_CONFIRMED_DAY_AND_SHIFT',
    'RUN_ON_PREVIOUS_CONFIRMED_DAY_AND_SHIFT',
    'RUN_IGNORE_CONFIRMATION_AND_SHIFT',
    'SHIFT_AND_DISABLE_RUN',
    'SHIFT_AND_RUN_ON_NEXT_CONFIRMED_DAY',
    'SHIFT_AND_RUN_ON_PREVIOUS_CONFIRMED_DAY',
    'SHIFT_AND_RUN_IGNORE_CONFIRMATION',
]);
export class ScheduleConfig {
    CALENDARS;
    SPECIFIC_DATES;
    WEEKDAYS_CALENDAR;
    WEEKDAYS;
    WEEK_MONTH_RELATION;
    MONTH_CALENDAR;
    MONTHDAYS;
    MONTHS;
    CONFIRMATION;
    ACTIVITY_PERIOD;
    constructor(config = {}) {
        this.CALENDARS = normalizeCalendars(config.CALENDARS || {});
        this.SPECIFIC_DATES = normalizeSpecificDates(config.SPECIFIC_DATES || []);
        this.WEEKDAYS_CALENDAR = config.WEEKDAYS_CALENDAR ?? null;
        this.WEEKDAYS = normalizeStringArray(config.WEEKDAYS || []);
        this.WEEK_MONTH_RELATION = (config.WEEK_MONTH_RELATION || 'OR').toUpperCase();
        this.MONTH_CALENDAR = config.MONTH_CALENDAR ?? null;
        this.MONTHDAYS = normalizeStringArray(config.MONTHDAYS || []);
        this.MONTHS = normalizeMonths(config.MONTHS || []);
        this.CONFIRMATION = normalizeConfirmation(config.CONFIRMATION || null);
        this.ACTIVITY_PERIOD = normalizeActivityPeriod(config.ACTIVITY_PERIOD || null);
    }
    update(newConfig = {}) {
        if ('CALENDARS' in newConfig)
            this.CALENDARS = normalizeCalendars(newConfig.CALENDARS || {});
        if ('SPECIFIC_DATES' in newConfig)
            this.SPECIFIC_DATES = normalizeSpecificDates(newConfig.SPECIFIC_DATES || []);
        if ('WEEKDAYS_CALENDAR' in newConfig)
            this.WEEKDAYS_CALENDAR = newConfig.WEEKDAYS_CALENDAR ?? null;
        if ('WEEKDAYS' in newConfig)
            this.WEEKDAYS = normalizeStringArray(newConfig.WEEKDAYS || []);
        if ('WEEK_MONTH_RELATION' in newConfig)
            this.WEEK_MONTH_RELATION = (newConfig.WEEK_MONTH_RELATION || 'OR').toUpperCase();
        if ('MONTH_CALENDAR' in newConfig)
            this.MONTH_CALENDAR = newConfig.MONTH_CALENDAR ?? null;
        if ('MONTHDAYS' in newConfig)
            this.MONTHDAYS = normalizeStringArray(newConfig.MONTHDAYS || []);
        if ('MONTHS' in newConfig)
            this.MONTHS = normalizeMonths(newConfig.MONTHS || []);
        if ('CONFIRMATION' in newConfig)
            this.CONFIRMATION = normalizeConfirmation(newConfig.CONFIRMATION || null);
        if ('ACTIVITY_PERIOD' in newConfig)
            this.ACTIVITY_PERIOD = normalizeActivityPeriod(newConfig.ACTIVITY_PERIOD || null);
    }
    addCalendar(calendarName, workdays = [1, 2, 3, 4, 5], holidays = []) {
        this.CALENDARS[calendarName] = normalizeCalendar(calendarName, { WORKDAYS: workdays, HOLIDAYS: holidays });
    }
    validate() {
        return validateConfig(this);
    }
    isDateEligible(date) {
        const validation = validateConfig(this);
        if (!validation.isValid) {
            throw new ScheduleValidationError('Invalid schedule configuration', validation.errors);
        }
        const parsedDate = toUtcDate(date);
        return evaluateScheduledDate(parsedDate, this) !== null;
    }
    getEligibleDates(year = new Date().getUTCFullYear()) {
        return getEligibleRunDates(this, year);
    }
}
export function validateConfig(config) {
    const errors = [];
    const warnings = [];
    if (!config || typeof config !== 'object') {
        return { isValid: false, errors: ['Configuration must be an object'], warnings: [] };
    }
    if (config.CALENDARS && (typeof config.CALENDARS !== 'object' || Array.isArray(config.CALENDARS))) {
        errors.push('CALENDARS must be an object');
    }
    else if (config.CALENDARS) {
        for (const [calendarName, calendar] of Object.entries(config.CALENDARS)) {
            validateCalendar(calendarName, calendar, errors);
        }
    }
    if (config.WEEKDAYS_CALENDAR && !config.CALENDARS?.[config.WEEKDAYS_CALENDAR]) {
        warnings.push(`WEEKDAYS_CALENDAR "${config.WEEKDAYS_CALENDAR}" not found in CALENDARS; falling back to standard Mon-Fri workdays.`);
    }
    if (config.MONTH_CALENDAR && !config.CALENDARS?.[config.MONTH_CALENDAR]) {
        warnings.push(`MONTH_CALENDAR "${config.MONTH_CALENDAR}" not found in CALENDARS; falling back to standard Mon-Fri workdays.`);
    }
    if (config.CONFIRMATION) {
        const { CALENDAR, EXCEPTION_POLICY, SHIFT_BY } = config.CONFIRMATION;
        if (!CALENDAR || !config.CALENDARS?.[CALENDAR]) {
            warnings.push(`CONFIRMATION.CALENDAR "${CALENDAR}" not found in CALENDARS; falling back to standard Mon-Fri workdays.`);
        }
        if (EXCEPTION_POLICY && !VALID_EXCEPTION_POLICIES.has(EXCEPTION_POLICY)) {
            errors.push(`Invalid CONFIRMATION.EXCEPTION_POLICY "${EXCEPTION_POLICY}"`);
        }
        if (SHIFT_BY === undefined || !Number.isInteger(SHIFT_BY) || SHIFT_BY < -62 || SHIFT_BY > 62) {
            errors.push('CONFIRMATION.SHIFT_BY must be an integer between -62 and 62');
        }
    }
    if (config.WEEK_MONTH_RELATION && !VALID_WEEK_MONTH_RELATIONS.has(config.WEEK_MONTH_RELATION)) {
        errors.push('WEEK_MONTH_RELATION must be either "AND" or "OR"');
    }
    if (config.MONTHS && !Array.isArray(config.MONTHS)) {
        errors.push('MONTHS must be an array');
    }
    else {
        for (const month of config.MONTHS || []) {
            if (!VALID_MONTHS.has(String(month).toUpperCase())) {
                errors.push(`Invalid month "${month}"`);
            }
        }
    }
    if (config.SPECIFIC_DATES && !Array.isArray(config.SPECIFIC_DATES)) {
        errors.push('SPECIFIC_DATES must be an array');
    }
    else {
        for (const value of config.SPECIFIC_DATES || []) {
            if (!isValidDateString(value)) {
                errors.push(`Invalid specific date "${value}". Expected YYYY-MM-DD`);
            }
        }
    }
    validateRuleArray(config.WEEKDAYS, 'WEEKDAYS', parseWeekdayRule, errors);
    validateRuleArray(config.MONTHDAYS, 'MONTHDAYS', parseMonthdayRule, errors);
    if (config.ACTIVITY_PERIOD) {
        const ap = config.ACTIVITY_PERIOD;
        if (ap.MODE && !VALID_ACTIVITY_MODES.has(ap.MODE)) {
            errors.push(`Invalid ACTIVITY_PERIOD.MODE "${ap.MODE}"`);
        }
        if (ap.MODE !== 'ALWAYS') {
            if (!ap.FROM || !isValidDateString(ap.FROM))
                errors.push('ACTIVITY_PERIOD.FROM must be a valid YYYY-MM-DD date');
            if (!ap.TO || !isValidDateString(ap.TO))
                errors.push('ACTIVITY_PERIOD.TO must be a valid YYYY-MM-DD date');
            if (ap.FROM && ap.TO && isValidDateString(ap.FROM) && isValidDateString(ap.TO) && ap.FROM > ap.TO) {
                errors.push('ACTIVITY_PERIOD.FROM must be less than or equal to ACTIVITY_PERIOD.TO');
            }
        }
    }
    if ((!config.SPECIFIC_DATES || config.SPECIFIC_DATES.length === 0) &&
        (!config.WEEKDAYS || config.WEEKDAYS.length === 0) &&
        (!config.MONTHDAYS || config.MONTHDAYS.length === 0)) {
        warnings.push('No SPECIFIC_DATES, WEEKDAYS, or MONTHDAYS defined. All allowed days in selected months will match.');
    }
    if (!config.CALENDARS || Object.keys(config.CALENDARS).length === 0) {
        warnings.push('No calendars defined. Calendar-based rules fall back to plain date semantics.');
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
}
export function getEligibleRunDates(schedulingConfig, year = new Date().getUTCFullYear()) {
    const validation = validateConfig(schedulingConfig);
    if (!validation.isValid) {
        return validation;
    }
    if (!Number.isInteger(year) || year < 1970 || year > 9999) {
        return {
            isValid: false,
            errors: ['Year must be an integer between 1970 and 9999'],
            warnings: [],
        };
    }
    const eligibleSet = new Set();
    const startDate = makeUtcDate(year, 0, 1);
    const endDate = makeUtcDate(year, 11, 31);
    for (let current = startDate; current <= endDate; current = addDays(current, 1)) {
        const eligibleDate = evaluateScheduledDate(current, schedulingConfig);
        if (eligibleDate) {
            eligibleSet.add(formatDate(eligibleDate));
        }
    }
    return Array.from(eligibleSet)
        .sort()
        .map((d) => parseDateString(d));
}
export function evaluateScheduledDate(date, config) {
    if (!matchesMonth(date, config.MONTHS))
        return null;
    if (!isActivityAllowed(date, config.ACTIVITY_PERIOD || null))
        return null;
    const specificDateMatch = (config.SPECIFIC_DATES || []).includes(formatDate(date));
    const weekdayMatch = evaluateWeekdayDimension(date, config);
    const monthdayMatch = evaluateMonthdayDimension(date, config);
    let baseMatch;
    if (specificDateMatch) {
        baseMatch = true;
    }
    else if ((!config.WEEKDAYS || config.WEEKDAYS.length === 0) && (!config.MONTHDAYS || config.MONTHDAYS.length === 0)) {
        baseMatch = Boolean(config.SPECIFIC_DATES && config.SPECIFIC_DATES.length > 0);
    }
    else if (config.WEEKDAYS && config.WEEKDAYS.length > 0 && (!config.MONTHDAYS || config.MONTHDAYS.length === 0)) {
        baseMatch = weekdayMatch;
    }
    else if ((!config.WEEKDAYS || config.WEEKDAYS.length === 0) && config.MONTHDAYS && config.MONTHDAYS.length > 0) {
        baseMatch = monthdayMatch;
    }
    else {
        baseMatch =
            config.WEEK_MONTH_RELATION === 'AND' ? weekdayMatch && monthdayMatch : weekdayMatch || monthdayMatch;
    }
    if (!baseMatch)
        return null;
    return applyConfirmationPolicy(date, config);
}
function evaluateWeekdayDimension(date, config) {
    if (!config.WEEKDAYS || config.WEEKDAYS.length === 0)
        return false;
    const calendar = config.WEEKDAYS_CALENDAR && config.CALENDARS?.[config.WEEKDAYS_CALENDAR]
        ? normalizeCalendar(config.WEEKDAYS_CALENDAR, config.CALENDARS[config.WEEKDAYS_CALENDAR])
        : null;
    const rules = config.WEEKDAYS.map(parseWeekdayRule);
    for (const rule of rules) {
        if (rule.modifier === '-' && matchesWeekdayRule(date, rule, calendar)) {
            return false;
        }
    }
    for (const rule of rules) {
        if (rule.modifier !== '-' && matchesWeekdayRule(date, rule, calendar)) {
            return true;
        }
    }
    return false;
}
function evaluateMonthdayDimension(date, config) {
    if (!config.MONTHDAYS || config.MONTHDAYS.length === 0)
        return false;
    const calendar = config.MONTH_CALENDAR && config.CALENDARS?.[config.MONTH_CALENDAR]
        ? normalizeCalendar(config.MONTH_CALENDAR, config.CALENDARS[config.MONTH_CALENDAR])
        : null;
    const rules = config.MONTHDAYS.map(parseMonthdayRule);
    for (const rule of rules) {
        if (rule.modifier === '-' && matchesMonthdayRule(date, rule, calendar)) {
            return false;
        }
    }
    for (const rule of rules) {
        if (rule.modifier !== '-' && matchesMonthdayRule(date, rule, calendar)) {
            return true;
        }
    }
    return false;
}
function matchesWeekdayRule(candidateDate, rule, calendar) {
    switch (rule.type) {
        case 'DAY_OF_WEEK': {
            const selectedDay = getDayOfWeekInSameWeek(candidateDate, rule.dayOfWeek);
            return applyWorkingDayModifierMatch(candidateDate, selectedDay, rule.modifier, calendar);
        }
        case 'NTH_WORKING_DAY_OF_WEEK': {
            if (!calendar) {
                return getDayIndexFromStartOfWeek(candidateDate) === rule.n;
            }
            const nthDate = getNthWorkingDayOfWeek(candidateDate, rule.n, calendar);
            return nthDate !== null && formatDate(candidateDate) === formatDate(nthDate);
        }
        case 'DAY_OF_WEEK_IN_WEEK_OF_MONTH': {
            if (getWeekOfMonth(candidateDate) !== rule.weekOfMonth)
                return false;
            const selectedDay = getDayOfWeekInSameWeek(candidateDate, rule.dayOfWeek);
            return applyWorkingDayModifierMatch(candidateDate, selectedDay, rule.modifier, calendar);
        }
        case 'NTH_FROM_END_OF_WORKING_WEEK': {
            if (!calendar) {
                return getDayIndexFromEndOfWeek(candidateDate) === rule.n;
            }
            const target = getNthWorkingDayFromEndOfWeek(candidateDate, rule.n, calendar);
            return target !== null && formatDate(candidateDate) === formatDate(target);
        }
        default:
            return false;
    }
}
function matchesMonthdayRule(candidateDate, rule, calendar) {
    switch (rule.type) {
        case 'ALL_WORKING_DAYS': {
            return !calendar || isWorkingDay(candidateDate, calendar);
        }
        case 'DAY_OF_MONTH': {
            const daysInMonth = getDaysInMonth(candidateDate);
            if (rule.dayOfMonth > daysInMonth)
                return false;
            const selectedDay = makeUtcDate(candidateDate.getUTCFullYear(), candidateDate.getUTCMonth(), rule.dayOfMonth);
            return applyWorkingDayModifierMatch(candidateDate, selectedDay, rule.modifier, calendar);
        }
        case 'NTH_WORKING_DAY_OF_MONTH': {
            if (!calendar) {
                return candidateDate.getUTCDate() === rule.n;
            }
            const nthDate = getNthWorkingDayOfMonth(candidateDate, rule.n, calendar);
            return nthDate !== null && formatDate(candidateDate) === formatDate(nthDate);
        }
        case 'NTH_FROM_END_OF_WORKING_MONTH': {
            if (!calendar) {
                const daysInMonth = getDaysInMonth(candidateDate);
                return candidateDate.getUTCDate() === daysInMonth - rule.n + 1;
            }
            const target = getNthWorkingDayFromEndOfMonth(candidateDate, rule.n, calendar);
            return target !== null && formatDate(candidateDate) === formatDate(target);
        }
        default:
            return false;
    }
}
function applyWorkingDayModifierMatch(candidateDate, selectedDay, modifier, calendar) {
    if (!selectedDay)
        return false;
    if (!calendar) {
        return formatDate(candidateDate) === formatDate(selectedDay);
    }
    if (modifier === '>') {
        const effective = isWorkingDay(selectedDay, calendar) ? selectedDay : getNextWorkingDay(selectedDay, calendar);
        return effective !== null && formatDate(candidateDate) === formatDate(effective);
    }
    if (modifier === '<') {
        const effective = isWorkingDay(selectedDay, calendar) ? selectedDay : getPreviousWorkingDay(selectedDay, calendar);
        return effective !== null && formatDate(candidateDate) === formatDate(effective);
    }
    return formatDate(candidateDate) === formatDate(selectedDay) && isWorkingDay(selectedDay, calendar);
}
function applyConfirmationPolicy(date, config) {
    if (!config.CONFIRMATION)
        return date;
    const { CALENDAR, EXCEPTION_POLICY, SHIFT_BY } = config.CONFIRMATION;
    if (!CALENDAR || !config.CALENDARS?.[CALENDAR])
        return date;
    const calendar = normalizeCalendar(CALENDAR, config.CALENDARS[CALENDAR]);
    const confirmed = isWorkingDay(date, calendar);
    const shiftAmount = SHIFT_BY ?? 0;
    switch (EXCEPTION_POLICY) {
        case 'DISABLE_RUN':
            return confirmed ? date : null;
        case 'RUN_ON_NEXT_CONFIRMED_DAY_AND_SHIFT': {
            const base = confirmed ? date : getNextWorkingDay(date, calendar);
            return base ? addDays(base, shiftAmount) : null;
        }
        case 'RUN_ON_PREVIOUS_CONFIRMED_DAY_AND_SHIFT': {
            const base = confirmed ? date : getPreviousWorkingDay(date, calendar);
            return base ? addDays(base, shiftAmount) : null;
        }
        case 'RUN_IGNORE_CONFIRMATION_AND_SHIFT':
            return addDays(date, shiftAmount);
        case 'SHIFT_AND_DISABLE_RUN': {
            const shifted = addDays(date, shiftAmount);
            return isWorkingDay(shifted, calendar) ? shifted : null;
        }
        case 'SHIFT_AND_RUN_ON_NEXT_CONFIRMED_DAY': {
            const shifted = addDays(date, shiftAmount);
            return isWorkingDay(shifted, calendar) ? shifted : getNextWorkingDay(shifted, calendar);
        }
        case 'SHIFT_AND_RUN_ON_PREVIOUS_CONFIRMED_DAY': {
            const shifted = addDays(date, shiftAmount);
            return isWorkingDay(shifted, calendar) ? shifted : getPreviousWorkingDay(shifted, calendar);
        }
        case 'SHIFT_AND_RUN_IGNORE_CONFIRMATION':
            return addDays(date, shiftAmount);
        default:
            return date;
    }
}
export function parseWeekdayRule(rawRule) {
    const rule = normalizeRule(rawRule);
    const modifier = extractModifier(rule);
    const body = stripModifier(rule);
    if (/^[1-7]$/.test(body)) {
        return { modifier, type: 'DAY_OF_WEEK', dayOfWeek: Number(body) };
    }
    if (/^D[1-7]$/.test(body)) {
        return { modifier, type: 'NTH_WORKING_DAY_OF_WEEK', n: Number(body.slice(1)) };
    }
    if (/^D[1-7]W[1-6]$/.test(body)) {
        return {
            modifier,
            type: 'DAY_OF_WEEK_IN_WEEK_OF_MONTH',
            dayOfWeek: Number(body[1]),
            weekOfMonth: Number(body[3]),
        };
    }
    if (/^L[1-7]$/.test(body)) {
        return { modifier, type: 'NTH_FROM_END_OF_WORKING_WEEK', n: Number(body.slice(1)) };
    }
    throw new Error(`Unsupported weekday rule "${rawRule}"`);
}
export function parseMonthdayRule(rawRule) {
    const rule = normalizeRule(rawRule);
    const modifier = extractModifier(rule);
    const body = stripModifier(rule);
    if (body === 'WORKDAYS') {
        return { modifier, type: 'ALL_WORKING_DAYS' };
    }
    if (/^([1-9]|[12][0-9]|3[01])$/.test(body)) {
        return { modifier, type: 'DAY_OF_MONTH', dayOfMonth: Number(body) };
    }
    if (/^D([1-9]|[12][0-9]|3[01])$/.test(body)) {
        return { modifier, type: 'NTH_WORKING_DAY_OF_MONTH', n: Number(body.slice(1)) };
    }
    if (/^L([1-9]|[12][0-9]|3[01])$/.test(body)) {
        return { modifier, type: 'NTH_FROM_END_OF_WORKING_MONTH', n: Number(body.slice(1)) };
    }
    throw new Error(`Unsupported monthday rule "${rawRule}"`);
}
function validateRuleArray(rules, label, parser, errors) {
    if (!rules)
        return;
    if (!Array.isArray(rules)) {
        errors.push(`${label} must be an array`);
        return;
    }
    for (const rule of rules) {
        try {
            parser(rule);
        }
        catch (err) {
            errors.push(err instanceof Error ? err.message : String(err));
        }
    }
}
function validateCalendar(calendarName, calendar, errors) {
    if (!calendar || typeof calendar !== 'object' || Array.isArray(calendar)) {
        errors.push(`Calendar "${calendarName}" must be an object`);
        return;
    }
    if (!Array.isArray(calendar.WORKDAYS)) {
        errors.push(`Calendar "${calendarName}" WORKDAYS must be an array`);
    }
    else {
        for (const day of calendar.WORKDAYS) {
            if (!Number.isInteger(day) || day < 1 || day > 7) {
                errors.push(`Calendar "${calendarName}" has invalid WORKDAY value "${day}". Valid values are 1-7 where 1=Mon and 7=Sun`);
            }
        }
    }
    if (!Array.isArray(calendar.HOLIDAYS)) {
        errors.push(`Calendar "${calendarName}" HOLIDAYS must be an array`);
    }
    else {
        for (const holiday of calendar.HOLIDAYS) {
            if (!isValidDateString(holiday)) {
                errors.push(`Calendar "${calendarName}" has invalid HOLIDAY "${holiday}". Expected YYYY-MM-DD`);
            }
        }
    }
}
function normalizeCalendars(calendars) {
    const result = {};
    for (const [name, calendar] of Object.entries(calendars || {})) {
        result[name] = normalizeCalendar(name, calendar);
    }
    return result;
}
function normalizeCalendar(name, calendar) {
    const workdays = Array.isArray(calendar?.WORKDAYS)
        ? [...new Set(calendar.WORKDAYS.map(Number))].sort((a, b) => a - b)
        : [1, 2, 3, 4, 5];
    const holidays = Array.isArray(calendar?.HOLIDAYS)
        ? [...new Set(calendar.HOLIDAYS.map(String))].sort()
        : [];
    return { NAME: name, WORKDAYS: workdays, HOLIDAYS: holidays };
}
function normalizeSpecificDates(dates) {
    return [...new Set((dates || []).map(String))].sort();
}
function normalizeMonths(months) {
    return [...new Set((months || []).map((m) => String(m).trim().toUpperCase()))];
}
function normalizeStringArray(values) {
    return [...new Set((values || []).map((v) => String(v).trim().toUpperCase()))];
}
function normalizeConfirmation(confirmation) {
    if (!confirmation)
        return null;
    return {
        CALENDAR: confirmation.CALENDAR ?? null,
        EXCEPTION_POLICY: String(confirmation.EXCEPTION_POLICY || '').trim().toUpperCase(),
        SHIFT_BY: Number(confirmation.SHIFT_BY ?? 0),
    };
}
function normalizeActivityPeriod(activityPeriod) {
    if (!activityPeriod) {
        return { MODE: 'ALWAYS', FROM: null, TO: null };
    }
    return {
        MODE: String(activityPeriod.MODE || 'ALWAYS').trim().toUpperCase(),
        FROM: activityPeriod.FROM ?? null,
        TO: activityPeriod.TO ?? null,
    };
}
function normalizeRule(rule) {
    if (rule == null || String(rule).trim() === '') {
        throw new Error('Rule must not be blank');
    }
    return String(rule).trim().toUpperCase();
}
function extractModifier(rule) {
    const first = rule[0];
    return ['-', '>', '<'].includes(first) ? first : '';
}
function stripModifier(rule) {
    return ['-', '>', '<'].includes(rule[0]) ? rule.slice(1) : rule;
}
export function matchesMonth(date, months) {
    if (!months || months.length === 0 || months.includes('ALL'))
        return true;
    return months.includes(MONTH_NAMES[date.getUTCMonth()]);
}
export function isActivityAllowed(date, activityPeriod) {
    if (!activityPeriod || activityPeriod.MODE === 'ALWAYS')
        return true;
    if (!activityPeriod.FROM || !activityPeriod.TO)
        return true;
    const from = parseDateString(activityPeriod.FROM);
    const to = parseDateString(activityPeriod.TO);
    if (!from || !to)
        return true;
    const dateStr = formatDate(date);
    const fromStr = formatDate(from);
    const toStr = formatDate(to);
    if (activityPeriod.MODE === 'ACTIVE') {
        return dateStr >= fromStr && dateStr <= toStr;
    }
    if (activityPeriod.MODE === 'NOT_ACTIVE') {
        return dateStr < fromStr || dateStr > toStr;
    }
    return true;
}
export function isWorkingDay(date, calendar) {
    if (!calendar)
        return true;
    const dayOfWeek = getIsoDayOfWeek(date);
    const dateStr = formatDate(date);
    return calendar.WORKDAYS.includes(dayOfWeek) && !calendar.HOLIDAYS.includes(dateStr);
}
export function getNthWorkingDayOfWeek(date, n, calendar) {
    if (n < 1 || n > 7)
        return null;
    const start = getStartOfWeek(date);
    let count = 0;
    for (let i = 0; i < 7; i++) {
        const current = addDays(start, i);
        if (isWorkingDay(current, calendar)) {
            count += 1;
            if (count === n)
                return current;
        }
    }
    return null;
}
export function getNthWorkingDayFromEndOfWeek(date, n, calendar) {
    if (n < 1 || n > 7)
        return null;
    const start = getStartOfWeek(date);
    let count = 0;
    for (let i = 6; i >= 0; i--) {
        const current = addDays(start, i);
        if (isWorkingDay(current, calendar)) {
            count += 1;
            if (count === n)
                return current;
        }
    }
    return null;
}
export function getNthWorkingDayOfMonth(date, n, calendar) {
    if (n < 1)
        return null;
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const daysInMonth = getDaysInMonth(date);
    let count = 0;
    for (let day = 1; day <= daysInMonth; day++) {
        const current = makeUtcDate(year, month, day);
        if (isWorkingDay(current, calendar)) {
            count += 1;
            if (count === n)
                return current;
        }
    }
    return null;
}
export function getNthWorkingDayFromEndOfMonth(date, n, calendar) {
    if (n < 1)
        return null;
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const daysInMonth = getDaysInMonth(date);
    let count = 0;
    for (let day = daysInMonth; day >= 1; day--) {
        const current = makeUtcDate(year, month, day);
        if (isWorkingDay(current, calendar)) {
            count += 1;
            if (count === n)
                return current;
        }
    }
    return null;
}
export function getNextWorkingDay(date, calendar) {
    let current = addDays(date, 1);
    for (let i = 0; i < 370; i++) {
        if (isWorkingDay(current, calendar))
            return current;
        current = addDays(current, 1);
    }
    return null;
}
export function getPreviousWorkingDay(date, calendar) {
    let current = addDays(date, -1);
    for (let i = 0; i < 370; i++) {
        if (isWorkingDay(current, calendar))
            return current;
        current = addDays(current, -1);
    }
    return null;
}
export function getStartOfWeek(date) {
    return addDays(date, -(getIsoDayOfWeek(date) - 1));
}
export function getDayOfWeekInSameWeek(date, isoDayOfWeek) {
    return addDays(getStartOfWeek(date), isoDayOfWeek - 1);
}
export function getWeekOfMonth(date) {
    const firstDayOfMonth = makeUtcDate(date.getUTCFullYear(), date.getUTCMonth(), 1);
    const offset = getIsoDayOfWeek(firstDayOfMonth) - 1;
    return Math.floor((date.getUTCDate() + offset - 1) / 7) + 1;
}
export function getDayIndexFromStartOfWeek(date) {
    return getIsoDayOfWeek(date);
}
export function getDayIndexFromEndOfWeek(date) {
    return 8 - getIsoDayOfWeek(date);
}
export function getIsoDayOfWeek(date) {
    const jsDay = date.getUTCDay();
    return jsDay === 0 ? 7 : jsDay;
}
export function getDaysInMonth(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}
export function isValidDateString(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const parsed = parseDateString(value);
    return parsed !== null && formatDate(parsed) === value;
}
export function parseDateString(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = makeUtcDate(year, month - 1, day);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }
    return date;
}
export function toUtcDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return makeUtcDate(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
    }
    if (typeof value === 'string') {
        const parsed = parseDateString(value);
        if (!parsed)
            throw new Error(`Invalid date string "${value}". Expected YYYY-MM-DD`);
        return parsed;
    }
    throw new Error('Date must be a valid Date object or YYYY-MM-DD string');
}
export function makeUtcDate(year, monthIndex, day) {
    return new Date(Date.UTC(year, monthIndex, day));
}
export function addDays(date, days) {
    const next = makeUtcDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    next.setUTCDate(next.getUTCDate() + days);
    return next;
}
export function formatDate(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
export function formatResults(results) {
    if (!Array.isArray(results) && results?.errors) {
        return results.errors;
    }
    return results.map(formatDate);
}
export const utils = {
    validateConfig,
    formatDate,
    formatResults,
    parseDateString,
    getWeekOfMonth,
    isWorkingDay,
    getNthWorkingDayOfWeek,
    getNthWorkingDayOfMonth,
    getNthWorkingDayFromEndOfWeek,
    getNthWorkingDayFromEndOfMonth,
    getNextWorkingDay,
    getPreviousWorkingDay,
};
export const dateCalculators = {
    getEligibleRunDates,
    evaluateScheduledDate,
};
export const parsers = {
    parseWeekdayRule,
    parseMonthdayRule,
};
export default {
    ScheduleConfig,
    ScheduleValidationError,
    utils,
    dateCalculators,
    parsers,
};
