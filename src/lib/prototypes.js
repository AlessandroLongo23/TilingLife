import { compareArrays } from '$utils';

Array.prototype.cyclicallyInclude = function(array) {
    if (array.length > this.length) return false;
    if (array.some(a => !this.includes(a))) return false;
    
    for (let i = 0; i < this.length; i++) {
        let match = true;
        for (let j = 0; j < array.length; j++) {
            if (this[(i + j) % this.length] != array[j]) {
                match = false;
                break;
            }
        }
        if (match) return true;
    }

    return false;
}

Array.prototype.pickRandom = function() {
    return this[Math.floor(Math.random() * this.length)];
}

String.prototype.count = function(char) {
    return this.split(char).length - 1;
}

Array.prototype.findSubsequenceStartingIndex = function(subsequence) {
    if (subsequence.length > this.length) return [];

    let startingIndexes = [];
    for (let i = 0; i < this.length; i++) {
        let match = true;
        for (let j = 0; j < subsequence.length; j++) {
            if (this[(i + j) % this.length] != subsequence[j]) {
                match = false;
                break;
            }
        }

        if (match) startingIndexes.push(i);
    }

    return startingIndexes;
}

Array.prototype.cycleToMinimumLexicographicalOrder = function() {
    let min = this.slice(0);
    for (let i = 0; i < this.length; i++) {
        let rotated = this.slice(i).concat(this.slice(0, i));
        if (compareArrays(rotated, min) < 0) {
            min = rotated;
        }
    }
    return min;
}

Array.prototype.isEqual = function(array) {
    if (this.length !== array.length) return false;
    for (let i = 0; i < this.length; i++)
        if (this[i] !== array[i]) return false;
    return true;
}

Array.prototype.isEqualOrChiral = function(array) {
    if (this.length !== array.length) return false;
    
    for (let i = 0; i < this.length; i++) {
        let rotated = this.slice(i).concat(this.slice(0, i));
        if (rotated.isEqual(array)) return true;
    }

    let reversed = this.slice().reverse();
    for (let i = 0; i < this.length; i++) {
        let rotated = reversed.slice(i).concat(reversed.slice(0, i));
        if (rotated.isEqual(array)) return true;
    }

    return false;
}

Array.prototype.last = function() {
    return this[this.length - 1];
}

Array.prototype.next = function(i) {
    return this[(i + 1) % this.length];
}

Array.prototype.prev = function(i) {
    return this[(i - 1 + this.length) % this.length];
}