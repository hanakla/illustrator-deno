#pragma once

#ifndef __HelloWorldPlugin_h__
#define __HelloWorldPlugin_h__

#include <AIDictionary.h>
#include <AIRasterize.h>
#include <IllustratorSDK.h>
#include "./libs/format.h"
#include "Plugin.hpp"
#include "SDKErrors.h"
#include "json.hpp"
#include "libai_deno.h"

#include "./views/ImgUIEditModal.h"
#include "AiDenoId.h"
#include "debugHelper.h"
#include "super-illustrator.h"

#define kMaxEffects 1000

using json = nlohmann::json;

struct PluginParams {
  std::string effectName;
  json        params;
};

struct PluginPreferences {
  AIPoint* windowPosition = nullptr;
};

Plugin* AllocatePlugin(SPPluginRef pluginRef);
void    FixupReload(Plugin* plugin);

using AdjustColorCallbackLambda = ai_deno::SafeString* (*)(const ai_deno::SafeString*);

extern "C" {
  ai_deno::SafeString*
  ai_deno_trampoline_adjust_color_callback(void* ptr, const ai_deno::SafeString* color);
}

class HelloWorldPlugin : public Plugin {
 public:
  HelloWorldPlugin(SPPluginRef pluginRef);
  virtual ~HelloWorldPlugin();

  FIXUP_VTABLE_EX(HelloWorldPlugin, Plugin);

  ASErr StartupPlugin(SPInterfaceMessage*);
  //    ASErr PostStartupPlugin();
  ASErr ShutdownPlugin(SPInterfaceMessage*);

 private:
  bool               pluginStarted = false;
  AILiveEffectHandle fEffects[kMaxEffects];
  ASInt32            fNumEffects;

  ai_deno::OpaqueAiMain aiDenoMain;

  ASErr InitMenus(SPInterfaceMessage*);
  ASErr InitLiveEffect(SPInterfaceMessage*);
  ASErr GoLiveEffect(AILiveEffectGoMessage*);
  ASErr LiveEffectScaleParameters(AILiveEffectScaleParamMessage*);
  ASErr LiveEffectAdjustColors(AILiveEffectAdjustColorsMessage*);
  ASErr LiveEffectInterpolate(AILiveEffectInterpParamMessage*);
  ASErr EditLiveEffectParameters(AILiveEffectEditParamMessage*);

  ASErr getDictionaryValues(const AILiveEffectParameters&, PluginParams*, PluginParams);
  ASErr putParamsToDictionaly(const AILiveEffectParameters& dict, PluginParams);

  PluginPreferences getPreferences(ASErr* error);
  void              putPreferences(PluginPreferences& preferences, ASErr* error);

  static void StaticHandleDenoAiAlert(const ai_deno::JsonFunctionResult* result);

  void HandleDenoAiAlert(ai_deno::JsonFunctionResult* request);
};

#endif
