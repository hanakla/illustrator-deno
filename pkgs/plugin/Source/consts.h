#pragma once

#include <string>
#include "spectrum-tokens.hpp"

#define AI_DENO_DEBUG 1

const std::string EFFECT_PREFIX = "la.hanak.illustrator-deno.";

const std::string AI_DENO_DICT_EFFECT_NAME = "AiDeno.effectId";
const std::string AI_DENO_DICT_PARAMS      = "AiDeno.params";

enum ModalStatusCode { None = 0, Cancel = 1, OK = 2 };

static const SpectrumTokens currentTheme = spectrumDark;
