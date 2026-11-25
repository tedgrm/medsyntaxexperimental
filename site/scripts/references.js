// References from one item to another in a query: #3 is the query of item 3. Loaded by the WORKSPACE and by its
// items (the EDITOR with ?ws=<id>). No DOM.
//
// A reference is a word of its own, outside quotes. A missing one has a question mark: #3? was item 3 until it was
// removed (Undo makes it #3 again), #? was removed before that.

// a quoted part as in editor.js (quotedTermRe), or what is before a reference and the reference
const referenceOrQuotesRe = /(["'])(?:(?=(\\?))\2.)*?\1|(^|[\s()])#([1-9][0-9]{0,5}\??|\?)(?=$|[\s()])/g;

const maximumFullQueryLength = 1000000;

// [{key, start, end}] with key '3', '3?' or '?'; from start to end is the text with its #
function findReferences(text) {
    return [...text.matchAll(referenceOrQuotesRe)]
        .filter((match) => match[4] !== undefined)
        .map((match) => {
            const start = match.index + match[3].length;
            return {key: match[4], start, end: start + 1 + match[4].length};
        });
}

// The new key of a reference. mapping: {'3': '2', '5': '5?', '5?': '5'}; '*?' is for every missing one.
function renumberedKey(key, mapping) {
    if (Object.hasOwn(mapping, key)) {
        return mapping[key];
    }
    return key.endsWith('?') && Object.hasOwn(mapping, '*?') ? mapping['*?'] : key;
}

// All references at once, so #1 to #2 and #2 to #1 don't run into each other. positions are places in the text,
// such as the cursor; the result has their new places.
function renumberText(text, mapping, positions = []) {
    let result = '';
    let done = 0;
    const newPositions = [...positions];
    findReferences(text).forEach(({key, start, end}) => {
        const newReference = '#' + renumberedKey(key, mapping);
        result += text.slice(done, start);
        const newStart = result.length;
        result += newReference;
        done = end;
        positions.forEach((position, index) => {
            if (position >= end) {
                newPositions[index] = position + result.length - end;
            } else if (position > start) {
                newPositions[index] = newStart + Math.min(position - start, newReference.length);
            }
        });
    });
    return {text: result + text.slice(done), positions: newPositions};
}

// As the warnings in editor.js that turn scope editing off
function hasUnbalancedSyntax(query) {
    const count = (character) => query.split(character).length - 1;
    const wrongOrder = (open, close) => query.includes(close) && query.indexOf(open) > query.indexOf(close);
    return count('"') % 2 !== 0 || count('\'') % 2 !== 0 || count('(') !== count(')') || count('[') !== count(']')
        || wrongOrder('(', ')') || wrongOrder('[', ']');
}

// In brackets, unless one pair is around all of it already
function inBrackets(query) {
    const withoutQuotes = query.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (quoted) => '_'.repeat(quoted.length));
    let depth = 0;
    for (let index = 0; index < withoutQuotes.length; index++) {
        depth += {'(': 1, ')': -1}[withoutQuotes[index]] || 0;
        if (depth === 0) {
            return index > 0 && index === withoutQuotes.length - 1 ? query : '(' + query + ')';
        }
    }
    return '(' + query + ')';
}

// For each query, in order: {references, full, problem}
//  - references: {key: problem or ''} of its own references
//  - full: the query with the full queries of its references in it ('' if there is a problem)
//  - problem: why it can't be used, or ''
function resolveQueries(queries) {
    const own = queries.map((query) => [...new Set(findReferences(query).map(({key}) => key))]);
    const targets = own.map((keys) => keys.map((key) => key.endsWith('?') ? -1 : key - 1)
        .filter((target) => target >= 0 && target < queries.length));

    // What each query leads to, through others too
    const reached = targets.map((first) => {
        const found = new Set();
        const toVisit = [...first];
        while (toVisit.length) {
            const target = toVisit.pop();
            if (!found.has(target)) {
                found.add(target);
                toVisit.push(...targets[target]);
            }
        }
        return found;
    });
    const isInCircle = (index) => reached[index].has(index);

    const results = [];
    // Its targets come first. Not for circles, so this always ends.
    const resolve = (start) => {
        const toDo = [start];
        while (toDo.length) {
            const index = toDo[toDo.length - 1];
            const waitingFor = results[index] || isInCircle(index) ? [] : targets[index].filter((target) => !results[target]);
            if (waitingFor.length) {
                toDo.push(...waitingFor);
            } else {
                toDo.pop();
                results[index] = results[index] || resolveOne(index);
            }
        }
    };
    const resolveOne = (index) => {
        const references = {};
        own[index].forEach((key) => {
            references[key] = referenceProblem(index, key);
        });
        const result = {references, full: '', problem: ''};
        if (queries[index].trim() === '') {
            result.problem = 'has no query';
        } else if (hasUnbalancedSyntax(queries[index])) {
            result.problem = 'has unbalanced brackets or quotes';
        } else if (isInCircle(index)) {
            result.problem = 'refers to itself';
        } else if (own[index].some((key) => references[key])) {
            result.problem = 'has a reference with a problem';
        } else {
            result.full = fullQuery(queries[index]);
            result.problem = result.full ? '' : 'is too long with its references';
        }
        return result;
    };
    const referenceProblem = (index, key) => {
        const target = key - 1;
        if (key.endsWith('?')) {
            return 'this query was removed';
        }
        if (target >= queries.length) {
            return 'there is no query ' + key;
        }
        if (reached[target].has(index)) {
            return 'it refers back to this query';
        }
        return results[target].problem && 'query ' + key + ' ' + results[target].problem;
    };
    // '' if it is too long
    const fullQuery = (query) => {
        const found = findReferences(query);
        const length = found.reduce((sum, {key}) => sum + results[key - 1].full.length + 2, query.length);
        if (length > maximumFullQueryLength) {
            return '';
        }
        let result = '';
        let done = 0;
        found.forEach(({key, start, end}) => {
            result += query.slice(done, start) + inBrackets(results[key - 1].full);
            done = end;
        });
        return (result + query.slice(done)).trim();
    };

    queries.forEach((query, index) => resolve(index));
    return results;
}
