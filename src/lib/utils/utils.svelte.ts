export const compareArrays = (a: any[], b: any[]): number => {
    if (a.length !== b.length) return a.length - b.length;

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            if (typeof a[i] === 'string' && typeof b[i] === 'string') {
                return a[i].localeCompare(b[i]);
            } else {
                return a[i] - b[i];
            }
        }
    }

    return 0;
}

export const cyclicallyInclude = (a: string[], b: string[]): boolean => {
    const aString = a.concat(a).join(',');
    const bString = b.join(',');
    return aString.includes(bString);
}

