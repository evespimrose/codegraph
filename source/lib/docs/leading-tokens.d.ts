/**
 * First `maxTokens` ids of the tokenized `text`, tokenizing only as much leading text as needed.
 * @param tokenize maps a string to its full id list, special tokens included and nothing truncated
 */
export declare function leadingTokenIds<T extends {
    length: number;
    slice(start: number, end: number): T;
}>(tokenize: (text: string) => T, text: string, maxTokens: number): T;
