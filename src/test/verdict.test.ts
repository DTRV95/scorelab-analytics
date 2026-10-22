import { describe, expect, it } from "vitest";
import { CALL_LABEL, callTone, decide, type VerdictInput } from "@/lib/verdict";
import type { AccuracyMarket } from "@/lib/modelAccuracy";
import { tallyVerdicts, type VerdictRow } from "@/lib/verdictRecord";

function input(over: Partial<VerdictInput> = {}): VerdictInput {
  return {
    headline: { market: "1X", pct: 74 },
    amostraPct: 92,
    record: null,
    // 74% prometidos valem 63% medidos, que pedem 1,59.
    prices: { "1X": 1.8 },
    implied: { "1X": 56 },
    ...over,
  };
}

function record(over: Partial<AccuracyMarket> = {}): AccuracyMarket {
  return {
    market: "1X",
    grupo: "Resultado",
    samples: 120,
    predicted_pct: 74,
    actual_pct: 62,
    gap_pp: -12,
    brier: 0.2,
    ...over,
  };
}

describe("decide", () => {
  it("manda apostar quando o preço paga acima do que a coisa vale", () => {
    const got = decide(input());

    expect(got.call).toBe("apostar");
    // 63% medidos contra 55,6% implícitos em 1,80: sobram 7,4 pontos.
    expect(got.edgePp).toBeCloseTo(7.4, 1);
    expect(got.because).toContain("1,80");
    expect(got.because).toContain("1,59");
  });

  it("manda passar quando o preço não chega", () => {
    const got = decide(input({ prices: { "1X": 1.4 } }));

    expect(got.call).toBe("passar");
    expect(got.because).toContain("perdes mesmo acertando");
  });

  it("manda esperar quando a vantagem é fina demais", () => {
    // 1,62 dá 61,7% implícitos contra 63% nossos: 1,3 pontos.
    const got = decide(input({ prices: { "1X": 1.62 } }));

    expect(got.call).toBe("esperar");
    expect(got.because).toContain("margem de erro");
  });

  it("manda esperar quando as casas ainda não abriram o jogo", () => {
    const got = decide(input({ prices: null, implied: null }));

    expect(got.call).toBe("esperar");
    expect(got.because).toContain("ainda não abriram");
    expect(got.because).toContain("1,59");
  });

  it("veta por histórico curto, mesmo com bom preço", () => {
    const got = decide(input({ amostraPct: 38, prices: { "1X": 3.0 } }));

    expect(got.call).toBe("passar");
    expect(got.because).toContain("38%");
  });

  it("veta um mercado onde já prometemos muito a mais", () => {
    const got = decide(input({ record: record(), prices: { "1X": 3.0 } }));

    expect(got.call).toBe("passar");
    expect(got.because).toContain("12,0 pontos a mais");
    expect(got.because).toContain("120 jogos");
  });

  it("não veta por um registo que ainda tem poucos jogos", () => {
    const got = decide(
      input({ record: record({ samples: 12 }), prices: { "1X": 3.0 } }),
    );

    expect(got.call).toBe("apostar");
  });

  it("veta quando discordamos demasiado do mercado", () => {
    // Nós 63%, mercado 48%: quinze pontos de diferença.
    const got = decide(input({ implied: { "1X": 48 }, prices: { "1X": 2.05 } }));

    expect(got.call).toBe("passar");
    expect(got.because).toContain("quem costuma estar errado somos nós");
  });

  it("não veta por uma discordância pequena", () => {
    const got = decide(input({ implied: { "1X": 56 } }));

    expect(got.call).toBe("apostar");
  });

  it("dá uma razão só, não uma lista", () => {
    // Três vetos ao mesmo tempo: histórico curto, registo mau e
    // desacordo com o mercado. Uma lista de motivos não é uma decisão.
    const got = decide(
      input({ amostraPct: 30, record: record(), implied: { "1X": 40 } }),
    );

    expect(got.call).toBe("passar");
    expect(got.because.split(".").filter(Boolean)).toHaveLength(1);
  });

  it("aguenta um jogo sem mercado principal", () => {
    const got = decide(input({ headline: null }));

    expect(got.call).toBe("esperar");
    expect(got.fairPct).toBeNull();
  });

  it("guarda sempre o preço e a mínima, para se conferir depois", () => {
    // É isto que permite medir, daqui a um mês, se o veredicto valeu
    // alguma coisa: a decisão sozinha não chega, é preciso o preço a
    // que ela foi dada.
    const got = decide(input());

    expect(got.price).toBe(1.8);
    expect(got.minimum).toBe(1.59);
    expect(got.fairPct).toBe(63);
  });
});

describe("apresentação", () => {
  it("dá cor de veredicto a cada decisão", () => {
    expect(callTone("apostar")).toBe("good");
    expect(callTone("passar")).toBe("bad");
    expect(callTone("esperar")).toBe("wait");
  });

  it("fala português a quem lê", () => {
    expect(CALL_LABEL.apostar).toBe("Vale a pena");
    expect(CALL_LABEL.passar).toBe("Deixa passar");
  });
});

describe("tallyVerdicts", () => {
  const row = (
    call: string,
    landed: boolean | null,
    price: number,
  ): VerdictRow => ({
    fixture_id: Math.random(),
    mercado: "1X",
    league: "Premier League",
    kickoff: null,
    call,
    fair_pct: 63,
    price,
    edge_pp: 5,
    because: "",
    decided_at: "",
    landed,
  });

  it("conta só os veredictos daquela decisão, e só os conferidos", () => {
    const got = tallyVerdicts(
      [
        row("apostar", true, 2.0),
        row("apostar", false, 2.0),
        row("passar", true, 2.0),
        row("apostar", null, 2.0),
      ],
      "apostar",
    );

    expect(got.settled).toBe(2);
    expect(got.landed).toBe(1);
    expect(got.winPct).toBe(50);
  });

  it("mede o lucro ao preço registado, não ao acerto", () => {
    // Acertar metade a 2,00 fica exactamente em zero. É este o número
    // que interessa: acertar muito a preços maus não é ganhar.
    const equilibrio = tallyVerdicts(
      [row("apostar", true, 2.0), row("apostar", false, 2.0)],
      "apostar",
    );
    expect(equilibrio.unitsProfit).toBe(0);
    expect(equilibrio.roi).toBe(0);

    // E acertar metade a 1,50 é perder, por muito que 50% pareça bom.
    const perda = tallyVerdicts(
      [row("apostar", true, 1.5), row("apostar", false, 1.5)],
      "apostar",
    );
    expect(perda.unitsProfit).toBe(-0.5);
    expect(perda.roi).toBe(-25);
  });

  it("não inventa números sem nada conferido", () => {
    const got = tallyVerdicts([row("apostar", null, 2.0)], "apostar");

    expect(got.settled).toBe(0);
    expect(got.winPct).toBeNull();
    expect(got.roi).toBeNull();
  });
});
