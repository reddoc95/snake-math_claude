/* ============================================
   Math Problem Generator
   ============================================ */
class MathProblemGenerator {
    constructor() {
        this.stats = { correct: 0, wrong: 0 };
    }

    resetStats() {
        this.stats = { correct: 0, wrong: 0 };
    }

    getAccuracy() {
        const total = this.stats.correct + this.stats.wrong;
        if (total === 0) return 100;
        return Math.round((this.stats.correct / total) * 100);
    }

    /**
     * Level definitions:
     * 1: 1자리 + 1자리 (덧셈만, 결과 ≤ 10)
     * 2: 1자리 + 1자리 (덧셈/뺄셈)
     * 3: 1자리 + 2자리 (덧셈/뺄셈)
     * 4: 2자리 + 2자리 (덧셈만)
     * 5: 2자리 + 2자리 (덧셈/뺄셈)
     * 6: 2자리 + 3자리 (덧셈/뺄셈)
     * 7: 3자리 + 3자리 (덧셈만)
     * 8: 3자리 + 3자리 (덧셈/뺄셈)
     * 9: 큰 수 혼합
     * 10: 마스터
     */
    generate(level) {
        let a, b, op, answer;
        const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

        switch (level) {
            case 1: // 1자리+1자리 덧셈만
                a = rand(1, 9);
                b = rand(1, 9);
                if (a + b > 10) { b = rand(1, 10 - a); }
                op = '+';
                answer = a + b;
                break;
            case 2: // 1자리+1자리 덧뺄
                op = Math.random() < 0.5 ? '+' : '-';
                if (op === '+') {
                    a = rand(1, 9); b = rand(1, 9); answer = a + b;
                } else {
                    a = rand(2, 9); b = rand(1, a - 1); answer = a - b;
                }
                break;
            case 3: // 1자리+2자리
                op = Math.random() < 0.5 ? '+' : '-';
                if (op === '+') {
                    a = rand(1, 9); b = rand(10, 30); answer = a + b;
                } else {
                    a = rand(10, 30); b = rand(1, 9);
                    if (a - b < 0) { [a, b] = [b, a]; }
                    answer = a - b;
                }
                break;
            case 4: // 2자리+2자리 덧셈
                a = rand(10, 50); b = rand(10, 50);
                op = '+'; answer = a + b;
                break;
            case 5: // 2자리+2자리 덧뺄
                op = Math.random() < 0.5 ? '+' : '-';
                a = rand(10, 99); b = rand(10, 99);
                if (op === '-' && a < b) [a, b] = [b, a];
                answer = op === '+' ? a + b : a - b;
                break;
            case 6: // 2자리+3자리
                op = Math.random() < 0.5 ? '+' : '-';
                a = rand(10, 99); b = rand(100, 500);
                if (op === '-') { [a, b] = [b, a]; }
                answer = op === '+' ? a + b : a - b;
                break;
            case 7: // 3자리+3자리 덧셈
                a = rand(100, 500); b = rand(100, 500);
                op = '+'; answer = a + b;
                break;
            case 8: // 3자리+3자리 덧뺄
                op = Math.random() < 0.5 ? '+' : '-';
                a = rand(100, 999); b = rand(100, 999);
                if (op === '-' && a < b) [a, b] = [b, a];
                answer = op === '+' ? a + b : a - b;
                break;
            case 9: // 큰 수 혼합
                op = Math.random() < 0.5 ? '+' : '-';
                a = rand(100, 9999); b = rand(100, 9999);
                if (op === '-' && a < b) [a, b] = [b, a];
                answer = op === '+' ? a + b : a - b;
                break;
            default: // 10+
                op = Math.random() < 0.5 ? '+' : '-';
                const mag = Math.min(level - 5, 5);
                const max = Math.pow(10, mag);
                a = rand(max / 10, max); b = rand(max / 10, max);
                if (op === '-' && a < b) [a, b] = [b, a];
                answer = op === '+' ? a + b : a - b;
                break;
        }

        // Determine blank position: 0=left, 1=right, 2=answer
        const blankType = this._chooseBlankType(level);
        return this._formatProblem(a, b, op, answer, blankType);
    }

    _chooseBlankType(level) {
        // Higher levels have more variety
        const r = Math.random();
        if (level <= 2) {
            // Mostly answer blank, sometimes left
            return r < 0.65 ? 2 : (r < 0.85 ? 0 : 1);
        }
        // Equal distribution
        return r < 0.4 ? 2 : (r < 0.7 ? 0 : 1);
    }

    _formatProblem(a, b, op, answer, blankType) {
        let displayText, correctAnswer, displayParts;

        switch (blankType) {
            case 0: // □ + b = answer  or  □ - b = answer
                correctAnswer = a;
                displayParts = [
                    { type: 'blank' },
                    { type: 'text', value: ` ${op} ${b} = ${answer}` }
                ];
                displayText = `□ ${op} ${b} = ${answer}`;
                break;
            case 1: // a + □ = answer
                correctAnswer = b;
                displayParts = [
                    { type: 'text', value: `${a} ${op} ` },
                    { type: 'blank' },
                    { type: 'text', value: ` = ${answer}` }
                ];
                displayText = `${a} ${op} □ = ${answer}`;
                break;
            case 2: // a + b = □
            default:
                correctAnswer = answer;
                displayParts = [
                    { type: 'text', value: `${a} ${op} ${b} = ` },
                    { type: 'blank' }
                ];
                displayText = `${a} ${op} ${b} = □`;
                break;
        }

        return {
            a, b, op, answer,
            correctAnswer,
            blankType,
            displayText,
            displayParts
        };
    }

    /**
     * Generate numbers to place on the board for a given problem.
     * Returns an array of { value, isCorrect }
     * For multi-digit answers, we split the answer into individual digits
     * that need to be collected in order.
     *
     * For simplicity in gameplay, we show the full number on tiles.
     */
    generateBoardNumbers(problem, level) {
        const correct = problem.correctAnswer;
        const numbers = [{ value: correct, isCorrect: true }];

        // Generate wrong answers
        const wrongCount = Math.min(4 + Math.floor(level / 2), 8);
        const usedNumbers = new Set([correct]);

        for (let i = 0; i < wrongCount; i++) {
            let wrong;
            let attempts = 0;
            do {
                wrong = this._generateWrongAnswer(correct, level);
                attempts++;
            } while (usedNumbers.has(wrong) && attempts < 50);

            if (!usedNumbers.has(wrong)) {
                usedNumbers.add(wrong);
                numbers.push({ value: wrong, isCorrect: false });
            }
        }

        return numbers;
    }

    _generateWrongAnswer(correct, level) {
        const strategies = [
            () => correct + Math.ceil(Math.random() * 5),
            () => correct - Math.ceil(Math.random() * 5),
            () => correct + 10,
            () => correct - 10,
            () => {
                // Swap digits
                const s = String(correct);
                if (s.length >= 2) {
                    const arr = s.split('');
                    const i = Math.floor(Math.random() * (arr.length - 1));
                    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
                    return parseInt(arr.join(''));
                }
                return correct + 1;
            },
            () => Math.abs(correct + (Math.random() < 0.5 ? 1 : -1) * (Math.floor(Math.random() * 3) + 1)),
        ];

        const strat = strategies[Math.floor(Math.random() * strategies.length)];
        let result = strat();
        if (result < 0) result = Math.abs(result);
        if (result === correct) result = correct + 1;
        return result;
    }

    getLevelConfig(level) {
        const configs = {
            1:  { name: '단계 1',  desc: '1자리+1자리\n덧셈', target: 30, speed: 280 },
            2:  { name: '단계 2',  desc: '1자리+1자리\n덧셈·뺄셈', target: 33, speed: 265 },
            3:  { name: '단계 3',  desc: '1자리+2자리\n덧셈·뺄셈', target: 36, speed: 250 },
            4:  { name: '단계 4',  desc: '2자리+2자리\n덧셈', target: 38, speed: 240 },
            5:  { name: '단계 5',  desc: '2자리+2자리\n덧셈·뺄셈', target: 40, speed: 230 },
            6:  { name: '단계 6',  desc: '2자리+3자리\n덧셈·뺄셈', target: 42, speed: 220 },
            7:  { name: '단계 7',  desc: '3자리+3자리\n덧셈', target: 44, speed: 210 },
            8:  { name: '단계 8',  desc: '3자리+3자리\n덧셈·뺄셈', target: 46, speed: 200 },
            9:  { name: '단계 9',  desc: '큰 수 혼합', target: 48, speed: 190 },
            10: { name: '단계 10', desc: '마스터', target: 50, speed: 180 },
        };

        if (configs[level]) return configs[level];
        return {
            name: `단계 ${level}`,
            desc: '마스터+',
            target: 50 + (level - 10) * 3,
            speed: Math.max(150, 180 - (level - 10) * 5)
        };
    }
}

window.mathGenerator = new MathProblemGenerator();
