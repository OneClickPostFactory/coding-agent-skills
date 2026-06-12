import { isDeepStrictEqual } from "node:util";

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function matchesType(value, expected) {
  if (expected === "number") return typeof value === "number" && Number.isFinite(value);
  if (expected === "integer") return Number.isInteger(value);
  if (expected === "object") {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  return valueType(value) === expected;
}

function decodePointerPart(part) {
  return part.replaceAll("~1", "/").replaceAll("~0", "~");
}

function resolveLocalReference(rootSchema, reference) {
  if (!reference.startsWith("#/")) {
    throw new Error(`only local schema references are supported: ${reference}`);
  }

  return reference
    .slice(2)
    .split("/")
    .map(decodePointerPart)
    .reduce((current, part) => current?.[part], rootSchema);
}

function childPath(parent, key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(String(key))
    ? `${parent}.${key}`
    : `${parent}[${JSON.stringify(String(key))}]`;
}

function validateNode(schema, value, currentPath, rootSchema, errors) {
  if (typeof schema === "boolean") {
    if (!schema) errors.push(`${currentPath}: value is rejected by the schema`);
    return;
  }

  if (schema.$ref) {
    const referenced = resolveLocalReference(rootSchema, schema.$ref);
    if (!referenced) {
      errors.push(`${currentPath}: unresolved schema reference ${schema.$ref}`);
      return;
    }
    validateNode(referenced, value, currentPath, rootSchema, errors);
  }

  if ("const" in schema && !isDeepStrictEqual(value, schema.const)) {
    errors.push(`${currentPath}: expected constant ${JSON.stringify(schema.const)}`);
  }

  if (schema.enum && !schema.enum.some((candidate) => isDeepStrictEqual(candidate, value))) {
    errors.push(`${currentPath}: value is not in the allowed enum`);
  }

  if (schema.type) {
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!expectedTypes.some((expected) => matchesType(value, expected))) {
      errors.push(
        `${currentPath}: expected ${expectedTypes.join(" or ")}, received ${valueType(value)}`,
      );
      return;
    }
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${currentPath}: string is shorter than ${schema.minLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${currentPath}: string does not match ${schema.pattern}`);
    }
    if (
      schema.format === "date-time" &&
      (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) ||
        Number.isNaN(Date.parse(value)))
    ) {
      errors.push(`${currentPath}: invalid UTC date-time`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${currentPath}: expected at least ${schema.minItems} items`);
    }
    if (schema.uniqueItems) {
      for (let index = 0; index < value.length; index += 1) {
        if (value.slice(0, index).some((item) => isDeepStrictEqual(item, value[index]))) {
          errors.push(`${currentPath}[${index}]: duplicate array item`);
        }
      }
    }
    if (schema.items) {
      value.forEach((item, index) => {
        validateNode(schema.items, item, `${currentPath}[${index}]`, rootSchema, errors);
      });
    }
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(value, required)) {
        errors.push(`${currentPath}: missing required property ${required}`);
      }
    }

    for (const [key, item] of Object.entries(value)) {
      if (schema.properties?.[key]) {
        validateNode(
          schema.properties[key],
          item,
          childPath(currentPath, key),
          rootSchema,
          errors,
        );
      } else if (schema.additionalProperties === false) {
        errors.push(`${childPath(currentPath, key)}: additional property is not allowed`);
      } else if (
        schema.additionalProperties &&
        typeof schema.additionalProperties === "object"
      ) {
        validateNode(
          schema.additionalProperties,
          item,
          childPath(currentPath, key),
          rootSchema,
          errors,
        );
      }
    }
  }
}

export function validateValue(schema, value) {
  const errors = [];
  validateNode(schema, value, "$", schema, errors);
  return errors;
}
