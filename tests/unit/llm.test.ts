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
    expect(result.choices).toBeDefined();
    expect(result.choices[0].message.content).toContain("Polévka");
  });

  it("returns raw OpenAI response for Czech menu", async () => {
    const content = {
      html: "<html><body><h1>Denní menu</h1><p>Svíčková na smetaně 145,-</p></body></html>",
      text: "Denní menu Svíčková na smetaně 145,-",
      url: "https://ceska-restaurace.cz"
    };

    const result = await extractMenu(content);

    expect(result).toHaveProperty("choices");
    expect(result.choices[0]).toHaveProperty("message");
    expect(result.choices[0].message).toHaveProperty("content");
    
    const parsedContent = JSON.parse(result.choices[0].message.content);
    expect(parsedContent).toHaveProperty("items");
    expect(parsedContent.items[0].name).toBe("Polévka");
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
});
