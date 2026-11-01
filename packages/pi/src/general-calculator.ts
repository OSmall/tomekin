import {parse, type MathNode, type ConstantNode, type OperatorNode, type FunctionNode, type SymbolNode} from "mathjs";
import {Type} from "@sinclair/typebox";

const functions = new Set(["abs", "sqrt", "exp", "log", "log10", "floor", "ceil", "round", "min", "max"]);
const constants = new Set(["pi", "e"]);
const operators = new Set(["+", "-", "*", "/", "^", "%"]);

/** Accept only bounded scalar arithmetic, never assignments, property access, collections or user functions. */
function validate(node: MathNode): void {
    let count = 0;
    node.traverse((child) => {
        if (++count > 128) throw new Error("Expression is too complex; use at most 128 terms and operations.");
        if (child.type === "ConstantNode") {
            if (typeof (child as ConstantNode).value !== "number" || !Number.isFinite((child as ConstantNode).value)) throw new Error("Only finite numeric constants are supported.");
        } else if (child.type === "ParenthesisNode") {
            // The enclosed node is checked separately.
        } else if (child.type === "OperatorNode") {
            const operator = child as OperatorNode;
            if (!operators.has(operator.op) || ![1, 2].includes(operator.args.length) || (operator.args.length === 1 && !["+", "-"].includes(operator.op))) throw new Error("Unsupported arithmetic operator.");
        } else if (child.type === "FunctionNode") {
            const fn = child as FunctionNode;
            if (fn.fn.type !== "SymbolNode" || !functions.has((fn.fn as SymbolNode).name) || fn.args.length < 1 || fn.args.length > 8) throw new Error("Unsupported function or argument count.");
        } else if (child.type === "SymbolNode") {
            if (!constants.has((child as SymbolNode).name) && !functions.has((child as SymbolNode).name)) throw new Error("Unknown name. Use only the documented constants and functions.");
        } else throw new Error("Only scalar arithmetic expressions are supported.");
    });
}

export function createGeneralCalculatorTool() {
    return {
        name: "calculate",
        label: "Tomekin: calculate",
        description: "Evaluate scalar arithmetic: +, -, *, /, ^, %, parentheses, pi, e, and abs, sqrt, exp, log, log10, floor, ceil, round, min, max. Maximum 512 characters and 128 syntax nodes. Results are finite floating-point numbers; supply your own assumptions and interpret the result.",
        parameters: Type.Object({expression: Type.String({minLength: 1, maxLength: 512, description: "One scalar mathematical expression"})}, {additionalProperties: false}),
        executionMode: "sequential" as const,
        async execute(_toolCallId: string, params: Record<string, unknown>, signal: AbortSignal) {
            let details: {expression: string; result: number} | {error: string; message: string};
            if (signal.aborted) details = {error: "cancelled", message: "Cancelled before calculation."};
            else try {
                if (Object.keys(params).length !== 1 || typeof params.expression !== "string" || !params.expression.trim() || params.expression.length > 512) throw new Error("Provide one nonempty expression of at most 512 characters.");
                const node = parse(params.expression);
                validate(node);
                const result: unknown = node.compile().evaluate();
                if (typeof result !== "number" || !Number.isFinite(result)) throw new Error("The result must be a finite real number; check domains and division by zero.");
                details = {expression: params.expression, result};
            } catch (error) {
                details = {error: "invalid_expression", message: error instanceof Error ? error.message.slice(0, 300) : "Could not evaluate expression."};
            }
            return {content: [{type: "text" as const, text: JSON.stringify(details, null, 2)}], details};
        },
    };
}
