import { beforeEach, describe, expect, it } from "vitest";
import {
  readLocalFavourites,
  toggled,
  writeLocalFavourites,
} from "@/lib/favourites";

describe("os jogos marcados", () => {
  beforeEach(() => localStorage.clear());

  it("marca e desmarca o mesmo jogo", () => {
    expect(toggled([], 901)).toEqual([901]);
    expect(toggled([901], 901)).toEqual([]);
  });

  it("não guarda o mesmo jogo duas vezes", () => {
    expect(toggled([901, 902], 901)).toEqual([902]);
    expect(toggled([902], 901)).toEqual([901, 902]);
  });

  it("guarda por ordem, para duas listas iguais serem iguais", () => {
    expect(toggled([905, 901], 903)).toEqual([901, 903, 905]);
  });

  it("sobrevive a uma ida e volta pelo telemóvel", () => {
    writeLocalFavourites([903, 901]);
    expect(readLocalFavourites()).toEqual([901, 903]);
  });

  it("não se engasga com o que não é uma lista de jogos", () => {
    localStorage.setItem("scorelab_favourite_matches", "isto não é JSON");
    expect(readLocalFavourites()).toEqual([]);

    // Um dia alguém guarda outra coisa nesta chave, ou uma versão antiga
    // guardou objectos: o que não for um número de jogo é deitado fora em
    // vez de ir estragar a comparação com o quadro.
    localStorage.setItem(
      "scorelab_favourite_matches",
      JSON.stringify([901, "902", null, { id: 903 }, -1, 0, 904.5]),
    );
    expect(readLocalFavourites()).toEqual([901, 902]);
  });
});
