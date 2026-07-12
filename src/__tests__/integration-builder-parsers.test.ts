import { describe, expect, it } from "vitest";
import {
  looksLikeOpenApiSpec,
  parseOpenApiSpec,
} from "@/lib/denis/integrations/parsers/openapi-parser";
import {
  looksLikePostmanCollection,
  parsePostmanCollection,
} from "@/lib/denis/integrations/parsers/postman-parser";

// A trimmed but realistic OpenAPI 3.0 document in the style of the
// canonical "Swagger Petstore" example widely published by the OpenAPI
// Initiative — apiKey security, operationId, request/response examples.
const PETSTORE_OPENAPI_3 = {
  openapi: "3.0.0",
  info: { title: "Swagger Petstore", version: "1.0.0" },
  servers: [{ url: "https://petstore.example.com/v1" }],
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: "apiKey", in: "header", name: "X-Api-Key" },
    },
  },
  paths: {
    "/pets": {
      get: {
        operationId: "listPets",
        summary: "List all pets",
        tags: ["pets"],
        responses: {
          "200": {
            content: {
              "application/json": {
                example: [{ id: 1, name: "Fido" }],
              },
            },
          },
        },
      },
      post: {
        operationId: "createPet",
        summary: "Create a pet",
        tags: ["pets"],
        requestBody: {
          content: {
            "application/json": { example: { name: "Rex" } },
          },
        },
        responses: {
          "201": {
            content: {
              "application/json": { example: { id: 2, name: "Rex" } },
            },
          },
        },
      },
    },
    "/pets/{petId}": {
      get: {
        operationId: "getPetById",
        summary: "Get a pet by id",
        responses: {
          "200": {
            content: { "application/json": { example: { id: 1, name: "Fido" } } },
          },
        },
      },
    },
  },
};

// Swagger 2.0 style — root-level securityDefinitions, OAuth2 flow.
const SWAGGER_2_DOC = {
  swagger: "2.0",
  info: { title: "Legacy Orders API", version: "2.1" },
  securityDefinitions: {
    OAuth2: {
      type: "oauth2",
      flow: "application",
      flows: { clientCredentials: {} },
    },
  },
  paths: {
    "/orders": {
      post: {
        summary: "Create an order",
        responses: { "200": {} },
      },
    },
  },
};

describe("parseOpenApiSpec", () => {
  it("detects a real OpenAPI 3.0 document", () => {
    expect(looksLikeOpenApiSpec(PETSTORE_OPENAPI_3)).toBe(true);
    expect(looksLikeOpenApiSpec({ foo: "bar" })).toBe(false);
  });

  it("extracts endpoints, operationId, and examples from a Petstore-style spec", () => {
    const spec = parseOpenApiSpec(PETSTORE_OPENAPI_3);

    expect(spec.title).toBe("Swagger Petstore");
    expect(spec.baseUrl).toBe("https://petstore.example.com/v1");
    expect(spec.endpoints).toHaveLength(3);

    const createPet = spec.endpoints.find((e) => e.operationId === "createPet");
    expect(createPet?.method).toBe("POST");
    expect(createPet?.path).toBe("/pets");
    expect(createPet?.requestExample).toEqual({ name: "Rex" });
    expect(createPet?.responseExample).toEqual({ id: 2, name: "Rex" });
  });

  it("extracts apiKey security scheme with header/name", () => {
    const spec = parseOpenApiSpec(PETSTORE_OPENAPI_3);
    expect(spec.securitySchemes).toEqual([
      { kind: "apiKey", in: "header", name: "X-Api-Key" },
    ]);
  });

  it("supports Swagger 2.0 root-level securityDefinitions and OAuth2 flows", () => {
    const spec = parseOpenApiSpec(SWAGGER_2_DOC);
    expect(spec.securitySchemes).toEqual([
      { kind: "oauth2", flows: ["clientCredentials"] },
    ]);
    expect(spec.endpoints).toHaveLength(1);
    expect(spec.endpoints[0]?.method).toBe("POST");
    expect(spec.endpoints[0]?.path).toBe("/orders");
  });

  it("never invents an example when the document has none", () => {
    const spec = parseOpenApiSpec(SWAGGER_2_DOC);
    expect(spec.endpoints[0]?.requestExample).toBeNull();
    expect(spec.endpoints[0]?.responseExample).toBeNull();
  });

  it("throws on a document that isn't OpenAPI/Swagger", () => {
    expect(() => parseOpenApiSpec({ item: [] })).toThrow(
      "Not an OpenAPI/Swagger document"
    );
  });
});

// A realistic, trimmed Postman Collection v2.1 export — nested folder,
// raw JSON request/response bodies, collection-level bearer auth.
const POSTMAN_COLLECTION = {
  info: {
    name: "Acme POS API",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth: { type: "bearer" },
  item: [
    {
      name: "Orders",
      item: [
        {
          name: "Create Order",
          request: {
            method: "POST",
            url: { raw: "https://api.acme.example.com/v1/orders" },
            body: { raw: JSON.stringify({ tableId: "5", items: [] }) },
          },
          response: [
            {
              body: JSON.stringify({ orderId: "abc123", status: "created" }),
            },
          ],
        },
      ],
    },
    {
      name: "List Tables",
      request: {
        method: "GET",
        url: { raw: "https://api.acme.example.com/v1/tables" },
      },
      response: [],
    },
  ],
};

describe("parsePostmanCollection", () => {
  it("detects a real Postman v2.1 collection", () => {
    expect(looksLikePostmanCollection(POSTMAN_COLLECTION)).toBe(true);
    expect(looksLikePostmanCollection({ foo: "bar" })).toBe(false);
  });

  it("flattens nested folders and parses request/response bodies", () => {
    const spec = parsePostmanCollection(POSTMAN_COLLECTION);

    expect(spec.title).toBe("Acme POS API");
    expect(spec.endpoints).toHaveLength(2);

    const createOrder = spec.endpoints.find((e) => e.operationId === "Create Order");
    expect(createOrder?.method).toBe("POST");
    expect(createOrder?.path).toBe("/v1/orders");
    expect(createOrder?.requestExample).toEqual({ tableId: "5", items: [] });
    expect(createOrder?.responseExample).toEqual({
      orderId: "abc123",
      status: "created",
    });

    const listTables = spec.endpoints.find((e) => e.operationId === "List Tables");
    expect(listTables?.method).toBe("GET");
    expect(listTables?.path).toBe("/v1/tables");
  });

  it("extracts collection-level bearer auth", () => {
    const spec = parsePostmanCollection(POSTMAN_COLLECTION);
    expect(spec.securitySchemes).toEqual([{ kind: "http", scheme: "bearer" }]);
  });

  it("throws on a document that isn't a Postman collection", () => {
    expect(() => parsePostmanCollection({ openapi: "3.0.0" })).toThrow(
      "Not a Postman collection"
    );
  });
});
