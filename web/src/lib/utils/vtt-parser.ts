import type { ValidNonNegativeNumber } from '../../core/toNumber/validNonNegativeNumber.js';
import {
	strToNonNegativeNumberOrUndefined_lenient,
	numberToValidNonNegativeNumberOrUndefined,
	number_toValidNonNegativeNumber_unsafe
} from '../../core/toNumber/validNonNegativeNumber.js';
import type { NonEmptyStringTrimmed } from '../../core/non-empty-string-trimmed.js';
import { String_toNonEmptyString_orUndefined_afterTrim } from '../../core/non-empty-string-trimmed.js';

export interface VttCue {
	start: ValidNonNegativeNumber;
	end: ValidNonNegativeNumber;
	text: NonEmptyStringTrimmed;
}

function parseTimestamp(timestamp: string): ValidNonNegativeNumber {
	const clean = timestamp.trim().replace(',', '.');
	const parts = clean.split(':');
	if (parts.length === 3) {
		const hours = strToNonNegativeNumberOrUndefined_lenient(parts[0]) ?? 0;
		const minutes = strToNonNegativeNumberOrUndefined_lenient(parts[1]) ?? 0;
		const seconds = strToNonNegativeNumberOrUndefined_lenient(parts[2]) ?? 0;
		const total = hours * 3600 + minutes * 60 + seconds;
		return numberToValidNonNegativeNumberOrUndefined(total) ?? number_toValidNonNegativeNumber_unsafe(0);
	} else if (parts.length === 2) {
		const minutes = strToNonNegativeNumberOrUndefined_lenient(parts[0]) ?? 0;
		const seconds = strToNonNegativeNumberOrUndefined_lenient(parts[1]) ?? 0;
		const total = minutes * 60 + seconds;
		return numberToValidNonNegativeNumberOrUndefined(total) ?? number_toValidNonNegativeNumber_unsafe(0);
	}
	return strToNonNegativeNumberOrUndefined_lenient(clean) ?? number_toValidNonNegativeNumber_unsafe(0);
}

export function parseVttText(vtt: string): VttCue[] {
	const lines = vtt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
	const cues: VttCue[] = [];

	let currentStart: ValidNonNegativeNumber = number_toValidNonNegativeNumber_unsafe(0);
	let currentEnd: ValidNonNegativeNumber = number_toValidNonNegativeNumber_unsafe(0);
	let currentTextLines: string[] = [];
	let isReadingCue = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();

		if (line.includes('-->')) {
			// Save previous cue if any
			if (isReadingCue && currentTextLines.length > 0) {
				const fullText = currentTextLines.join(' ').replace(/<[^>]*>/g, '');
				const validText = String_toNonEmptyString_orUndefined_afterTrim(fullText);
				if (validText) {
					cues.push({
						start: currentStart,
						end: currentEnd,
						text: validText
					});
				}
				currentTextLines = [];
			}

			const [startPart, endPart] = line.split('-->');
			currentStart = parseTimestamp(startPart.trim());
			const endTimestampStr = endPart.trim().split(/\s+/)[0];
			currentEnd = parseTimestamp(endTimestampStr);
			isReadingCue = true;
		} else if (isReadingCue) {
			if (line.length === 0) {
				if (currentTextLines.length > 0) {
					const fullText = currentTextLines.join(' ').replace(/<[^>]*>/g, '');
					const validText = String_toNonEmptyString_orUndefined_afterTrim(fullText);
					if (validText) {
						cues.push({
							start: currentStart,
							end: currentEnd,
							text: validText
						});
					}
					currentTextLines = [];
				}
				isReadingCue = false;
			} else if (!line.startsWith('NOTE') && !line.startsWith('WEBVTT') && !line.startsWith('STYLE')) {
				currentTextLines.push(line);
			}
		}
	}

	if (isReadingCue && currentTextLines.length > 0) {
		const fullText = currentTextLines.join(' ').replace(/<[^>]*>/g, '');
		const validText = String_toNonEmptyString_orUndefined_afterTrim(fullText);
		if (validText) {
			cues.push({
				start: currentStart,
				end: currentEnd,
				text: validText
			});
		}
	}

	return cues;
}
