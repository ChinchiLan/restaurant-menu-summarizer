import { extractMenu } from "../../src/services/llm";

jest.mock("openai", () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [{ name: "Polévka", price: 45 }]
                })
              }
            }
          ]
        })
      }
    }
  }));
});

describe("LLM Service - Czech Data", () => {
  const originalEnv = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.OPENAI_API_KEY = originalEnv;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  it("extractMenu() calls OpenAI with Czech content", async () => {
    const content = {
      html: "<html><body><h1>Jídelní lístek</h1><p>Polévka 45,-</p></body></html>",
      text: "Jídelní lístek Polévka 45,-",
      url: "https://restaurace.cz"
    };

    const result = await extractMenu(content);

    expect(result).toBeDefined();
    expect(result.items).toBeDefined();
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items[0].name).toBe("Polévka");
  });

  it("returns parsed MenuResponse for Czech menu", async () => {
    const content = {
      html: "<html><body><h1>Denní menu</h1><p>Svíčková na smetaně 145,-</p></body></html>",
      text: "Denní menu Svíčková na smetaně 145,-",
      url: "https://ceska-restaurace.cz"
    };

    const result = await extractMenu(content);

    expect(result).toHaveProperty("items");
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items[0]).toHaveProperty("name");
    expect(result.items[0].name).toBe("Polévka");
  });

  it("throws if OPENAI_API_KEY missing", async () => {
    delete process.env.OPENAI_API_KEY;

    const content = {
      html: "<p>Polévka</p>",
      text: "Polévka",
      url: "https://restaurace.cz"
    };

    await expect(extractMenu(content)).rejects.toThrow(
      "Missing OPENAI_API_KEY. Set it in .env"
    );
  });

  it("handles Czech menu with special characters", async () => {
    const OpenAI = require("openai");
    const mockCreate = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                { name: "Švestkové knedlíky", price: 85 },
                { name: "Řízek s bramborovým salátem", price: 125 },
                { name: "Česnečka", price: 55 }
              ]
            })
          }
        }
      ]
    });

    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }));

    const content = {
      html: "<p>Švestkové knedlíky, Řízek, Česnečka</p>",
      text: "Švestkové knedlíky, Řízek, Česnečka",
      url: "https://restaurace.cz"
    };

    const result = await extractMenu(content);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("Švestkové knedlíky")
          })
        ])
      })
    );
    expect(result.items).toHaveLength(3);
    expect(result.items[0].name).toBe("Švestkové knedlíky");
  });

  it("includes Czech price format in function call", async () => {
    const OpenAI = require("openai");
    const mockCreate = jest.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ items: [] }) } }]
    });

    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }));

    const content = {
      html: "<p>Polévka 145,-</p>",
      text: "Polévka 145,-",
      url: "https://restaurace.cz"
    };

    await extractMenu(content);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("145,-")
          })
        ])
      })
    );
  });

  it("throws error for invalid JSON from LLM", async () => {
    const OpenAI = require("openai");
    const mockCreate = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: "not valid json"
          }
        }
      ]
    });

    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }));

    const content = {
      html: "<p>test</p>",
      text: "test",
      url: "https://restaurace.cz"
    };

    await expect(extractMenu(content)).rejects.toThrow(
      "LLM extraction failed: Invalid JSON returned from LLM"
    );
  });

  it("throws error for invalid schema from LLM", async () => {
    const OpenAI = require("openai");
    const mockCreate = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ wrong: "schema" })
          }
        }
      ]
    });

    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }));

    const content = {
      html: "<p>test</p>",
      text: "test",
      url: "https://restaurace.cz"
    };

    await expect(extractMenu(content)).rejects.toThrow(
      "LLM extraction failed: LLM output did not match MenuResponse schema"
    );
  });

  it("normalizes price strings in items", async () => {
    const OpenAI = require("openai");
    const mockCreate = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                { name: "Polévka", price: "45,-" as any },
                { name: "Svíčková", price: "145 Kč" as any }
              ]
            })
          }
        }
      ]
    });

    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }));

    const content = {
      html: "<p>test</p>",
      text: "test",
      url: "https://restaurace.cz"
    };

    const result = await extractMenu(content);

    expect(result.items[0].price).toBe(45);
    expect(result.items[1].price).toBe(145);
  });
});
