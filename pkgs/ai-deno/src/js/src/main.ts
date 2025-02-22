import { blurEffect } from "./live-effects/blurEffect.ts";
import { randomNoiseEffect } from "./live-effects/effects.ts";
import { Effect, UINode } from "./types.ts";

const allEffects: Effect<any>[] = [randomNoiseEffect, blurEffect];

export const getLiveEffects = (): Array<{
  id: string;
  title: string;
  version: { major: number; minor: number };
}> => {
  return allEffects.map((effect) => ({
    id: effect.id,
    title: effect.title,
    version: effect.version,
  }));
};

export const getEffectViewNode = (id: string, state: any): UINode => {
  const effect = findEffect(id);
  if (!effect) return null;
  const defaultValues = getDefaultValus(id);

  try {
    return effect.renderUI({
      ...defaultValues,
      ...state,
    });
  } catch (e) {
    console.error(e);
    throw e;
  }
};

export const doLiveEffect = async (
  id: string,
  state: any,
  width: number,
  height: number,
  data: Uint8ClampedArray
) => {
  const effect = findEffect(id);
  if (!effect) return null;
  const defaultValues = getDefaultValus(id);

  try {
    const result = await effect.doLiveEffect(
      {
        ...defaultValues,
        ...state,
      },
      {
        width,
        height,
        data,
      }
    );

    if (
      typeof result.width !== "number" ||
      typeof result.height !== "number" ||
      !(result.data instanceof Uint8ClampedArray)
    ) {
      throw new Error("Invalid result from doLiveEffect");
    }

    return result;
  } catch (e) {
    console.error(e);
    throw e;
  }
};

const getDefaultValus = (effectId: string) => {
  const effect = findEffect(effectId);
  if (!effect) return null;
  return Object.fromEntries(
    Object.entries(effect.paramSchema).map(([key, value]) => [
      key,
      structuredClone(value.default),
    ])
  );
};

const findEffect = (id: string) => {
  const effect = allEffects.find((e) => e.id === id);
  if (!effect) console.error(`Effect not found: ${id}`);
  return effect;
};
