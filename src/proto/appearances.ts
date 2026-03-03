/* eslint-disable */
import * as _m0 from "protobufjs/minimal";

export const protobufPackage = "otclient.protobuf.appearances";

export enum playerAction {
  PLAYER_ACTION_NONE = 0,
  PLAYER_ACTION_LOOK = 1,
  PLAYER_ACTION_USE = 2,
  PLAYER_ACTION_OPEN = 3,
  PLAYER_ACTION_AUTOWALK_HIGHLIGHT = 4,
  UNRECOGNIZED = -1,
}

export function playerActionFromJSON(object: any): playerAction {
  switch (object) {
    case 0:
    case "PLAYER_ACTION_NONE":
      return playerAction.PLAYER_ACTION_NONE;
    case 1:
    case "PLAYER_ACTION_LOOK":
      return playerAction.PLAYER_ACTION_LOOK;
    case 2:
    case "PLAYER_ACTION_USE":
      return playerAction.PLAYER_ACTION_USE;
    case 3:
    case "PLAYER_ACTION_OPEN":
      return playerAction.PLAYER_ACTION_OPEN;
    case 4:
    case "PLAYER_ACTION_AUTOWALK_HIGHLIGHT":
      return playerAction.PLAYER_ACTION_AUTOWALK_HIGHLIGHT;
    case -1:
    case "UNRECOGNIZED":
    default:
      return playerAction.UNRECOGNIZED;
  }
}

export function playerActionToJSON(object: playerAction): string {
  switch (object) {
    case playerAction.PLAYER_ACTION_NONE:
      return "PLAYER_ACTION_NONE";
    case playerAction.PLAYER_ACTION_LOOK:
      return "PLAYER_ACTION_LOOK";
    case playerAction.PLAYER_ACTION_USE:
      return "PLAYER_ACTION_USE";
    case playerAction.PLAYER_ACTION_OPEN:
      return "PLAYER_ACTION_OPEN";
    case playerAction.PLAYER_ACTION_AUTOWALK_HIGHLIGHT:
      return "PLAYER_ACTION_AUTOWALK_HIGHLIGHT";
    case playerAction.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export enum itemCategory {
  ITEM_CATEGORY_ARMORS = 1,
  ITEM_CATEGORY_AMULETS = 2,
  ITEM_CATEGORY_BOOTS = 3,
  ITEM_CATEGORY_CONTAINERS = 4,
  ITEM_CATEGORY_DECORATION = 5,
  ITEM_CATEGORY_FOOD = 6,
  ITEM_CATEGORY_HELMETS_HATS = 7,
  ITEM_CATEGORY_LEGS = 8,
  ITEM_CATEGORY_OTHERS = 9,
  ITEM_CATEGORY_POTIONS = 10,
  ITEM_CATEGORY_RINGS = 11,
  ITEM_CATEGORY_RUNES = 12,
  ITEM_CATEGORY_SHIELDS = 13,
  ITEM_CATEGORY_TOOLS = 14,
  ITEM_CATEGORY_VALUABLES = 15,
  ITEM_CATEGORY_AMMUNITION = 16,
  ITEM_CATEGORY_AXES = 17,
  ITEM_CATEGORY_CLUBS = 18,
  ITEM_CATEGORY_DISTANCE_WEAPONS = 19,
  ITEM_CATEGORY_SWORDS = 20,
  ITEM_CATEGORY_WANDS_RODS = 21,
  ITEM_CATEGORY_PREMIUM_SCROLLS = 22,
  ITEM_CATEGORY_TIBIA_COINS = 23,
  ITEM_CATEGORY_CREATURE_PRODUCTS = 24,
  ITEM_CATEGORY_QUIVER = 25,
  ITEM_CATEGORY_SOUL_CORES = 26,
  ITEM_CATEGORY_FIST_WEAPONS = 27,
  UNRECOGNIZED = -1,
}

export function itemCategoryFromJSON(object: any): itemCategory {
  switch (object) {
    case 1:
    case "ITEM_CATEGORY_ARMORS":
      return itemCategory.ITEM_CATEGORY_ARMORS;
    case 2:
    case "ITEM_CATEGORY_AMULETS":
      return itemCategory.ITEM_CATEGORY_AMULETS;
    case 3:
    case "ITEM_CATEGORY_BOOTS":
      return itemCategory.ITEM_CATEGORY_BOOTS;
    case 4:
    case "ITEM_CATEGORY_CONTAINERS":
      return itemCategory.ITEM_CATEGORY_CONTAINERS;
    case 5:
    case "ITEM_CATEGORY_DECORATION":
      return itemCategory.ITEM_CATEGORY_DECORATION;
    case 6:
    case "ITEM_CATEGORY_FOOD":
      return itemCategory.ITEM_CATEGORY_FOOD;
    case 7:
    case "ITEM_CATEGORY_HELMETS_HATS":
      return itemCategory.ITEM_CATEGORY_HELMETS_HATS;
    case 8:
    case "ITEM_CATEGORY_LEGS":
      return itemCategory.ITEM_CATEGORY_LEGS;
    case 9:
    case "ITEM_CATEGORY_OTHERS":
      return itemCategory.ITEM_CATEGORY_OTHERS;
    case 10:
    case "ITEM_CATEGORY_POTIONS":
      return itemCategory.ITEM_CATEGORY_POTIONS;
    case 11:
    case "ITEM_CATEGORY_RINGS":
      return itemCategory.ITEM_CATEGORY_RINGS;
    case 12:
    case "ITEM_CATEGORY_RUNES":
      return itemCategory.ITEM_CATEGORY_RUNES;
    case 13:
    case "ITEM_CATEGORY_SHIELDS":
      return itemCategory.ITEM_CATEGORY_SHIELDS;
    case 14:
    case "ITEM_CATEGORY_TOOLS":
      return itemCategory.ITEM_CATEGORY_TOOLS;
    case 15:
    case "ITEM_CATEGORY_VALUABLES":
      return itemCategory.ITEM_CATEGORY_VALUABLES;
    case 16:
    case "ITEM_CATEGORY_AMMUNITION":
      return itemCategory.ITEM_CATEGORY_AMMUNITION;
    case 17:
    case "ITEM_CATEGORY_AXES":
      return itemCategory.ITEM_CATEGORY_AXES;
    case 18:
    case "ITEM_CATEGORY_CLUBS":
      return itemCategory.ITEM_CATEGORY_CLUBS;
    case 19:
    case "ITEM_CATEGORY_DISTANCE_WEAPONS":
      return itemCategory.ITEM_CATEGORY_DISTANCE_WEAPONS;
    case 20:
    case "ITEM_CATEGORY_SWORDS":
      return itemCategory.ITEM_CATEGORY_SWORDS;
    case 21:
    case "ITEM_CATEGORY_WANDS_RODS":
      return itemCategory.ITEM_CATEGORY_WANDS_RODS;
    case 22:
    case "ITEM_CATEGORY_PREMIUM_SCROLLS":
      return itemCategory.ITEM_CATEGORY_PREMIUM_SCROLLS;
    case 23:
    case "ITEM_CATEGORY_TIBIA_COINS":
      return itemCategory.ITEM_CATEGORY_TIBIA_COINS;
    case 24:
    case "ITEM_CATEGORY_CREATURE_PRODUCTS":
      return itemCategory.ITEM_CATEGORY_CREATURE_PRODUCTS;
    case 25:
    case "ITEM_CATEGORY_QUIVER":
      return itemCategory.ITEM_CATEGORY_QUIVER;
    case 26:
    case "ITEM_CATEGORY_SOUL_CORES":
      return itemCategory.ITEM_CATEGORY_SOUL_CORES;
    case 27:
    case "ITEM_CATEGORY_FIST_WEAPONS":
      return itemCategory.ITEM_CATEGORY_FIST_WEAPONS;
    case -1:
    case "UNRECOGNIZED":
    default:
      return itemCategory.UNRECOGNIZED;
  }
}

export function itemCategoryToJSON(object: itemCategory): string {
  switch (object) {
    case itemCategory.ITEM_CATEGORY_ARMORS:
      return "ITEM_CATEGORY_ARMORS";
    case itemCategory.ITEM_CATEGORY_AMULETS:
      return "ITEM_CATEGORY_AMULETS";
    case itemCategory.ITEM_CATEGORY_BOOTS:
      return "ITEM_CATEGORY_BOOTS";
    case itemCategory.ITEM_CATEGORY_CONTAINERS:
      return "ITEM_CATEGORY_CONTAINERS";
    case itemCategory.ITEM_CATEGORY_DECORATION:
      return "ITEM_CATEGORY_DECORATION";
    case itemCategory.ITEM_CATEGORY_FOOD:
      return "ITEM_CATEGORY_FOOD";
    case itemCategory.ITEM_CATEGORY_HELMETS_HATS:
      return "ITEM_CATEGORY_HELMETS_HATS";
    case itemCategory.ITEM_CATEGORY_LEGS:
      return "ITEM_CATEGORY_LEGS";
    case itemCategory.ITEM_CATEGORY_OTHERS:
      return "ITEM_CATEGORY_OTHERS";
    case itemCategory.ITEM_CATEGORY_POTIONS:
      return "ITEM_CATEGORY_POTIONS";
    case itemCategory.ITEM_CATEGORY_RINGS:
      return "ITEM_CATEGORY_RINGS";
    case itemCategory.ITEM_CATEGORY_RUNES:
      return "ITEM_CATEGORY_RUNES";
    case itemCategory.ITEM_CATEGORY_SHIELDS:
      return "ITEM_CATEGORY_SHIELDS";
    case itemCategory.ITEM_CATEGORY_TOOLS:
      return "ITEM_CATEGORY_TOOLS";
    case itemCategory.ITEM_CATEGORY_VALUABLES:
      return "ITEM_CATEGORY_VALUABLES";
    case itemCategory.ITEM_CATEGORY_AMMUNITION:
      return "ITEM_CATEGORY_AMMUNITION";
    case itemCategory.ITEM_CATEGORY_AXES:
      return "ITEM_CATEGORY_AXES";
    case itemCategory.ITEM_CATEGORY_CLUBS:
      return "ITEM_CATEGORY_CLUBS";
    case itemCategory.ITEM_CATEGORY_DISTANCE_WEAPONS:
      return "ITEM_CATEGORY_DISTANCE_WEAPONS";
    case itemCategory.ITEM_CATEGORY_SWORDS:
      return "ITEM_CATEGORY_SWORDS";
    case itemCategory.ITEM_CATEGORY_WANDS_RODS:
      return "ITEM_CATEGORY_WANDS_RODS";
    case itemCategory.ITEM_CATEGORY_PREMIUM_SCROLLS:
      return "ITEM_CATEGORY_PREMIUM_SCROLLS";
    case itemCategory.ITEM_CATEGORY_TIBIA_COINS:
      return "ITEM_CATEGORY_TIBIA_COINS";
    case itemCategory.ITEM_CATEGORY_CREATURE_PRODUCTS:
      return "ITEM_CATEGORY_CREATURE_PRODUCTS";
    case itemCategory.ITEM_CATEGORY_QUIVER:
      return "ITEM_CATEGORY_QUIVER";
    case itemCategory.ITEM_CATEGORY_SOUL_CORES:
      return "ITEM_CATEGORY_SOUL_CORES";
    case itemCategory.ITEM_CATEGORY_FIST_WEAPONS:
      return "ITEM_CATEGORY_FIST_WEAPONS";
    case itemCategory.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export enum playerProfession {
  PLAYER_PROFESSION_ANY = -1,
  PLAYER_PROFESSION_NONE = 0,
  PLAYER_PROFESSION_KNIGHT = 1,
  PLAYER_PROFESSION_PALADIN = 2,
  PLAYER_PROFESSION_SORCERER = 3,
  PLAYER_PROFESSION_DRUID = 4,
  PLAYER_PROFESSION_MONK = 5,
  PLAYER_PROFESSION_PROMOTED = 10,
  UNRECOGNIZED = -1,
}

export function playerProfessionFromJSON(object: any): playerProfession {
  switch (object) {
    case -1:
    case "PLAYER_PROFESSION_ANY":
      return playerProfession.PLAYER_PROFESSION_ANY;
    case 0:
    case "PLAYER_PROFESSION_NONE":
      return playerProfession.PLAYER_PROFESSION_NONE;
    case 1:
    case "PLAYER_PROFESSION_KNIGHT":
      return playerProfession.PLAYER_PROFESSION_KNIGHT;
    case 2:
    case "PLAYER_PROFESSION_PALADIN":
      return playerProfession.PLAYER_PROFESSION_PALADIN;
    case 3:
    case "PLAYER_PROFESSION_SORCERER":
      return playerProfession.PLAYER_PROFESSION_SORCERER;
    case 4:
    case "PLAYER_PROFESSION_DRUID":
      return playerProfession.PLAYER_PROFESSION_DRUID;
    case 5:
    case "PLAYER_PROFESSION_MONK":
      return playerProfession.PLAYER_PROFESSION_MONK;
    case 10:
    case "PLAYER_PROFESSION_PROMOTED":
      return playerProfession.PLAYER_PROFESSION_PROMOTED;
    case -1:
    case "UNRECOGNIZED":
    default:
      return playerProfession.UNRECOGNIZED;
  }
}

export function playerProfessionToJSON(object: playerProfession): string {
  switch (object) {
    case playerProfession.PLAYER_PROFESSION_ANY:
      return "PLAYER_PROFESSION_ANY";
    case playerProfession.PLAYER_PROFESSION_NONE:
      return "PLAYER_PROFESSION_NONE";
    case playerProfession.PLAYER_PROFESSION_KNIGHT:
      return "PLAYER_PROFESSION_KNIGHT";
    case playerProfession.PLAYER_PROFESSION_PALADIN:
      return "PLAYER_PROFESSION_PALADIN";
    case playerProfession.PLAYER_PROFESSION_SORCERER:
      return "PLAYER_PROFESSION_SORCERER";
    case playerProfession.PLAYER_PROFESSION_DRUID:
      return "PLAYER_PROFESSION_DRUID";
    case playerProfession.PLAYER_PROFESSION_MONK:
      return "PLAYER_PROFESSION_MONK";
    case playerProfession.PLAYER_PROFESSION_PROMOTED:
      return "PLAYER_PROFESSION_PROMOTED";
    case playerProfession.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export enum animationLoopType {
  ANIMATION_LOOP_TYPE_PINGPONG = -1,
  ANIMATION_LOOP_TYPE_INFINITE = 0,
  ANIMATION_LOOP_TYPE_COUNTED = 1,
  UNRECOGNIZED = -1,
}

export function animationLoopTypeFromJSON(object: any): animationLoopType {
  switch (object) {
    case -1:
    case "ANIMATION_LOOP_TYPE_PINGPONG":
      return animationLoopType.ANIMATION_LOOP_TYPE_PINGPONG;
    case 0:
    case "ANIMATION_LOOP_TYPE_INFINITE":
      return animationLoopType.ANIMATION_LOOP_TYPE_INFINITE;
    case 1:
    case "ANIMATION_LOOP_TYPE_COUNTED":
      return animationLoopType.ANIMATION_LOOP_TYPE_COUNTED;
    case -1:
    case "UNRECOGNIZED":
    default:
      return animationLoopType.UNRECOGNIZED;
  }
}

export function animationLoopTypeToJSON(object: animationLoopType): string {
  switch (object) {
    case animationLoopType.ANIMATION_LOOP_TYPE_PINGPONG:
      return "ANIMATION_LOOP_TYPE_PINGPONG";
    case animationLoopType.ANIMATION_LOOP_TYPE_INFINITE:
      return "ANIMATION_LOOP_TYPE_INFINITE";
    case animationLoopType.ANIMATION_LOOP_TYPE_COUNTED:
      return "ANIMATION_LOOP_TYPE_COUNTED";
    case animationLoopType.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export enum hookType {
  HOOK_TYPE_SOUTH = 1,
  HOOK_TYPE_EAST = 2,
  UNRECOGNIZED = -1,
}

export function hookTypeFromJSON(object: any): hookType {
  switch (object) {
    case 1:
    case "HOOK_TYPE_SOUTH":
      return hookType.HOOK_TYPE_SOUTH;
    case 2:
    case "HOOK_TYPE_EAST":
      return hookType.HOOK_TYPE_EAST;
    case -1:
    case "UNRECOGNIZED":
    default:
      return hookType.UNRECOGNIZED;
  }
}

export function hookTypeToJSON(object: hookType): string {
  switch (object) {
    case hookType.HOOK_TYPE_SOUTH:
      return "HOOK_TYPE_SOUTH";
    case hookType.HOOK_TYPE_EAST:
      return "HOOK_TYPE_EAST";
    case hookType.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export enum fixedFrameGroup {
  FIXED_FRAME_GROUP_OUTFIT_IDLE = 0,
  FIXED_FRAME_GROUP_OUTFIT_MOVING = 1,
  FIXED_FRAME_GROUP_OBJECT_INITIAL = 2,
  UNRECOGNIZED = -1,
}

export function fixedFrameGroupFromJSON(object: any): fixedFrameGroup {
  switch (object) {
    case 0:
    case "FIXED_FRAME_GROUP_OUTFIT_IDLE":
      return fixedFrameGroup.FIXED_FRAME_GROUP_OUTFIT_IDLE;
    case 1:
    case "FIXED_FRAME_GROUP_OUTFIT_MOVING":
      return fixedFrameGroup.FIXED_FRAME_GROUP_OUTFIT_MOVING;
    case 2:
    case "FIXED_FRAME_GROUP_OBJECT_INITIAL":
      return fixedFrameGroup.FIXED_FRAME_GROUP_OBJECT_INITIAL;
    case -1:
    case "UNRECOGNIZED":
    default:
      return fixedFrameGroup.UNRECOGNIZED;
  }
}

export function fixedFrameGroupToJSON(object: fixedFrameGroup): string {
  switch (object) {
    case fixedFrameGroup.FIXED_FRAME_GROUP_OUTFIT_IDLE:
      return "FIXED_FRAME_GROUP_OUTFIT_IDLE";
    case fixedFrameGroup.FIXED_FRAME_GROUP_OUTFIT_MOVING:
      return "FIXED_FRAME_GROUP_OUTFIT_MOVING";
    case fixedFrameGroup.FIXED_FRAME_GROUP_OBJECT_INITIAL:
      return "FIXED_FRAME_GROUP_OBJECT_INITIAL";
    case fixedFrameGroup.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export interface Coordinate {
  x: number;
  y: number;
  z: number;
}

export interface Appearances {
  object: Appearance[];
  outfit: Appearance[];
  effect: Appearance[];
  missile: Appearance[];
  specialMeaningAppearanceIds: SpecialMeaningAppearanceIds | undefined;
}

export interface SpritePhase {
  durationMin: number;
  durationMax: number;
}

export interface SpriteAnimation {
  defaultStartPhase: number;
  synchronized: boolean;
  randomStartPhase: boolean;
  loopType: animationLoopType;
  loopCount: number;
  spritePhase: SpritePhase[];
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpriteInfo {
  patternWidth: number;
  patternHeight: number;
  patternDepth: number;
  layers: number;
  spriteId: number[];
  boundingSquare: number;
  animation: SpriteAnimation | undefined;
  isOpaque: boolean;
  boundingBoxPerDirection: Box[];
}

export interface FrameGroup {
  fixedFrameGroup: fixedFrameGroup;
  id: number;
  spriteInfo: SpriteInfo | undefined;
}

export interface Appearance {
  id: number;
  frameGroup: FrameGroup[];
  flags: AppearanceFlags | undefined;
  name: string;
  description: string;
}

export interface AppearanceFlags {
  bank: AppearanceFlagBank | undefined;
  clip: boolean;
  bottom: boolean;
  top: boolean;
  container: boolean;
  cumulative: boolean;
  usable: boolean;
  forceuse: boolean;
  multiuse: boolean;
  write: AppearanceFlagWrite | undefined;
  writeOnce: AppearanceFlagWriteOnce | undefined;
  liquidpool: boolean;
  unpass: boolean;
  unmove: boolean;
  unsight: boolean;
  avoid: boolean;
  noMovementAnimation: boolean;
  take: boolean;
  liquidcontainer: boolean;
  hang: boolean;
  hook: AppearanceFlagHook | undefined;
  rotate: boolean;
  light: AppearanceFlagLight | undefined;
  dontHide: boolean;
  translucent: boolean;
  shift: AppearanceFlagShift | undefined;
  height: AppearanceFlagHeight | undefined;
  lyingObject: boolean;
  animateAlways: boolean;
  automap: AppearanceFlagAutomap | undefined;
  lenshelp: AppearanceFlagLenshelp | undefined;
  fullbank: boolean;
  ignoreLook: boolean;
  clothes: AppearanceFlagClothes | undefined;
  defaultAction: AppearanceFlagDefaultAction | undefined;
  market: AppearanceFlagMarket | undefined;
  wrap: boolean;
  unwrap: boolean;
  topeffect: boolean;
  npcsaledata: AppearanceFlagNPC[];
  changedtoexpire: AppearanceFlagChangedToExpire | undefined;
  corpse: boolean;
  playerCorpse: boolean;
  cyclopediaitem: AppearanceFlagCyclopedia | undefined;
  ammo: boolean;
  showOffSocket: boolean;
  reportable: boolean;
  upgradeclassification: AppearanceFlagUpgradeClassification | undefined;
  reverseAddonsEast: boolean;
  reverseAddonsWest: boolean;
  reverseAddonsSouth: boolean;
  reverseAddonsNorth: boolean;
  wearout: boolean;
  clockexpire: boolean;
  expire: boolean;
  expirestop: boolean;
  decoKit: boolean;
  skillwheelGem: AppearanceFlagSkillWheelGem | undefined;
  dualWielding: boolean;
  hookSouth: boolean;
  hookEast: boolean;
  transparencylevel: AppearanceFlagTransparencyLevel | undefined;
}

export interface AppearanceFlagUpgradeClassification {
  upgradeClassification: number;
}

export interface AppearanceFlagTransparencyLevel {
  level: number;
}

export interface AppearanceFlagBank {
  waypoints: number;
}

export interface AppearanceFlagWrite {
  maxTextLength: number;
}

export interface AppearanceFlagWriteOnce {
  maxTextLengthOnce: number;
}

export interface AppearanceFlagLight {
  brightness: number;
  color: number;
}

export interface AppearanceFlagHeight {
  elevation: number;
}

export interface AppearanceFlagShift {
  x: number;
  y: number;
}

export interface AppearanceFlagClothes {
  slot: number;
}

export interface AppearanceFlagDefaultAction {
  action: playerAction;
}

export interface AppearanceFlagMarket {
  category: itemCategory;
  tradeAsObjectId: number;
  showAsObjectId: number;
  name: string;
  restrictToProfession: playerProfession[];
  minimumLevel: number;
}

export interface AppearanceFlagNPC {
  name: string;
  location: string;
  salePrice: number;
  buyPrice: number;
  currencyObjectTypeId: number;
  currencyQuestFlagDisplayName: string;
}

export interface AppearanceFlagAutomap {
  color: number;
}

export interface AppearanceFlagHook {
  south: hookType;
  east: hookType;
}

export interface AppearanceFlagLenshelp {
  id: number;
}

export interface AppearanceFlagChangedToExpire {
  formerObjectTypeid: number;
}

export interface AppearanceFlagCyclopedia {
  cyclopediaType: number;
}

export interface AppearanceFlagSkillWheelGem {
  gemQualityId: number;
  vocationId: number;
}

export interface SpecialMeaningAppearanceIds {
  goldCoinId: number;
  platinumCoinId: number;
  crystalCoinId: number;
  tibiaCoinId: number;
  stampedLetterId: number;
  supplyStashId: number;
}

function createBaseCoordinate(): Coordinate {
  return { x: 0, y: 0, z: 0 };
}

export const Coordinate = {
  encode(message: Coordinate, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.x !== 0) {
      writer.uint32(8).uint32(message.x);
    }
    if (message.y !== 0) {
      writer.uint32(16).uint32(message.y);
    }
    if (message.z !== 0) {
      writer.uint32(24).uint32(message.z);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Coordinate {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCoordinate();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.x = reader.uint32();
          break;
        case 2:
          message.y = reader.uint32();
          break;
        case 3:
          message.z = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Coordinate {
    return {
      x: isSet(object.x) ? Number(object.x) : 0,
      y: isSet(object.y) ? Number(object.y) : 0,
      z: isSet(object.z) ? Number(object.z) : 0,
    };
  },

  toJSON(message: Coordinate): unknown {
    const obj: any = {};
    message.x !== undefined && (obj.x = Math.round(message.x));
    message.y !== undefined && (obj.y = Math.round(message.y));
    message.z !== undefined && (obj.z = Math.round(message.z));
    return obj;
  },

  create<I extends Exact<DeepPartial<Coordinate>, I>>(base?: I): Coordinate {
    return Coordinate.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Coordinate>, I>>(object: I): Coordinate {
    const message = createBaseCoordinate();
    message.x = object.x ?? 0;
    message.y = object.y ?? 0;
    message.z = object.z ?? 0;
    return message;
  },
};

function createBaseAppearances(): Appearances {
  return { object: [], outfit: [], effect: [], missile: [], specialMeaningAppearanceIds: undefined };
}

export const Appearances = {
  encode(message: Appearances, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.object) {
      Appearance.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    for (const v of message.outfit) {
      Appearance.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    for (const v of message.effect) {
      Appearance.encode(v!, writer.uint32(26).fork()).ldelim();
    }
    for (const v of message.missile) {
      Appearance.encode(v!, writer.uint32(34).fork()).ldelim();
    }
    if (message.specialMeaningAppearanceIds !== undefined) {
      SpecialMeaningAppearanceIds.encode(message.specialMeaningAppearanceIds, writer.uint32(42).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Appearances {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearances();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.object.push(Appearance.decode(reader, reader.uint32()));
          break;
        case 2:
          message.outfit.push(Appearance.decode(reader, reader.uint32()));
          break;
        case 3:
          message.effect.push(Appearance.decode(reader, reader.uint32()));
          break;
        case 4:
          message.missile.push(Appearance.decode(reader, reader.uint32()));
          break;
        case 5:
          message.specialMeaningAppearanceIds = SpecialMeaningAppearanceIds.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Appearances {
    return {
      object: Array.isArray(object?.object) ? object.object.map((e: any) => Appearance.fromJSON(e)) : [],
      outfit: Array.isArray(object?.outfit) ? object.outfit.map((e: any) => Appearance.fromJSON(e)) : [],
      effect: Array.isArray(object?.effect) ? object.effect.map((e: any) => Appearance.fromJSON(e)) : [],
      missile: Array.isArray(object?.missile) ? object.missile.map((e: any) => Appearance.fromJSON(e)) : [],
      specialMeaningAppearanceIds: isSet(object.specialMeaningAppearanceIds)
        ? SpecialMeaningAppearanceIds.fromJSON(object.specialMeaningAppearanceIds)
        : undefined,
    };
  },

  toJSON(message: Appearances): unknown {
    const obj: any = {};
    if (message.object) {
      obj.object = message.object.map((e) => e ? Appearance.toJSON(e) : undefined);
    } else {
      obj.object = [];
    }
    if (message.outfit) {
      obj.outfit = message.outfit.map((e) => e ? Appearance.toJSON(e) : undefined);
    } else {
      obj.outfit = [];
    }
    if (message.effect) {
      obj.effect = message.effect.map((e) => e ? Appearance.toJSON(e) : undefined);
    } else {
      obj.effect = [];
    }
    if (message.missile) {
      obj.missile = message.missile.map((e) => e ? Appearance.toJSON(e) : undefined);
    } else {
      obj.missile = [];
    }
    message.specialMeaningAppearanceIds !== undefined &&
      (obj.specialMeaningAppearanceIds = message.specialMeaningAppearanceIds
        ? SpecialMeaningAppearanceIds.toJSON(message.specialMeaningAppearanceIds)
        : undefined);
    return obj;
  },

  create<I extends Exact<DeepPartial<Appearances>, I>>(base?: I): Appearances {
    return Appearances.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Appearances>, I>>(object: I): Appearances {
    const message = createBaseAppearances();
    message.object = object.object?.map((e) => Appearance.fromPartial(e)) || [];
    message.outfit = object.outfit?.map((e) => Appearance.fromPartial(e)) || [];
    message.effect = object.effect?.map((e) => Appearance.fromPartial(e)) || [];
    message.missile = object.missile?.map((e) => Appearance.fromPartial(e)) || [];
    message.specialMeaningAppearanceIds =
      (object.specialMeaningAppearanceIds !== undefined && object.specialMeaningAppearanceIds !== null)
        ? SpecialMeaningAppearanceIds.fromPartial(object.specialMeaningAppearanceIds)
        : undefined;
    return message;
  },
};

function createBaseSpritePhase(): SpritePhase {
  return { durationMin: 0, durationMax: 0 };
}

export const SpritePhase = {
  encode(message: SpritePhase, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.durationMin !== 0) {
      writer.uint32(8).uint32(message.durationMin);
    }
    if (message.durationMax !== 0) {
      writer.uint32(16).uint32(message.durationMax);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SpritePhase {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSpritePhase();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.durationMin = reader.uint32();
          break;
        case 2:
          message.durationMax = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SpritePhase {
    return {
      durationMin: isSet(object.durationMin) ? Number(object.durationMin) : 0,
      durationMax: isSet(object.durationMax) ? Number(object.durationMax) : 0,
    };
  },

  toJSON(message: SpritePhase): unknown {
    const obj: any = {};
    message.durationMin !== undefined && (obj.durationMin = Math.round(message.durationMin));
    message.durationMax !== undefined && (obj.durationMax = Math.round(message.durationMax));
    return obj;
  },

  create<I extends Exact<DeepPartial<SpritePhase>, I>>(base?: I): SpritePhase {
    return SpritePhase.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<SpritePhase>, I>>(object: I): SpritePhase {
    const message = createBaseSpritePhase();
    message.durationMin = object.durationMin ?? 0;
    message.durationMax = object.durationMax ?? 0;
    return message;
  },
};

function createBaseSpriteAnimation(): SpriteAnimation {
  return {
    defaultStartPhase: 0,
    synchronized: false,
    randomStartPhase: false,
    loopType: 0,
    loopCount: 0,
    spritePhase: [],
  };
}

export const SpriteAnimation = {
  encode(message: SpriteAnimation, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.defaultStartPhase !== 0) {
      writer.uint32(8).uint32(message.defaultStartPhase);
    }
    if (message.synchronized === true) {
      writer.uint32(16).bool(message.synchronized);
    }
    if (message.randomStartPhase === true) {
      writer.uint32(24).bool(message.randomStartPhase);
    }
    if (message.loopType !== 0) {
      writer.uint32(32).int32(message.loopType);
    }
    if (message.loopCount !== 0) {
      writer.uint32(40).uint32(message.loopCount);
    }
    for (const v of message.spritePhase) {
      SpritePhase.encode(v!, writer.uint32(50).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SpriteAnimation {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSpriteAnimation();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.defaultStartPhase = reader.uint32();
          break;
        case 2:
          message.synchronized = reader.bool();
          break;
        case 3:
          message.randomStartPhase = reader.bool();
          break;
        case 4:
          message.loopType = reader.int32() as any;
          break;
        case 5:
          message.loopCount = reader.uint32();
          break;
        case 6:
          message.spritePhase.push(SpritePhase.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SpriteAnimation {
    return {
      defaultStartPhase: isSet(object.defaultStartPhase) ? Number(object.defaultStartPhase) : 0,
      synchronized: isSet(object.synchronized) ? Boolean(object.synchronized) : false,
      randomStartPhase: isSet(object.randomStartPhase) ? Boolean(object.randomStartPhase) : false,
      loopType: isSet(object.loopType) ? animationLoopTypeFromJSON(object.loopType) : 0,
      loopCount: isSet(object.loopCount) ? Number(object.loopCount) : 0,
      spritePhase: Array.isArray(object?.spritePhase)
        ? object.spritePhase.map((e: any) => SpritePhase.fromJSON(e))
        : [],
    };
  },

  toJSON(message: SpriteAnimation): unknown {
    const obj: any = {};
    message.defaultStartPhase !== undefined && (obj.defaultStartPhase = Math.round(message.defaultStartPhase));
    message.synchronized !== undefined && (obj.synchronized = message.synchronized);
    message.randomStartPhase !== undefined && (obj.randomStartPhase = message.randomStartPhase);
    message.loopType !== undefined && (obj.loopType = animationLoopTypeToJSON(message.loopType));
    message.loopCount !== undefined && (obj.loopCount = Math.round(message.loopCount));
    if (message.spritePhase) {
      obj.spritePhase = message.spritePhase.map((e) => e ? SpritePhase.toJSON(e) : undefined);
    } else {
      obj.spritePhase = [];
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<SpriteAnimation>, I>>(base?: I): SpriteAnimation {
    return SpriteAnimation.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<SpriteAnimation>, I>>(object: I): SpriteAnimation {
    const message = createBaseSpriteAnimation();
    message.defaultStartPhase = object.defaultStartPhase ?? 0;
    message.synchronized = object.synchronized ?? false;
    message.randomStartPhase = object.randomStartPhase ?? false;
    message.loopType = object.loopType ?? 0;
    message.loopCount = object.loopCount ?? 0;
    message.spritePhase = object.spritePhase?.map((e) => SpritePhase.fromPartial(e)) || [];
    return message;
  },
};

function createBaseBox(): Box {
  return { x: 0, y: 0, width: 0, height: 0 };
}

export const Box = {
  encode(message: Box, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.x !== 0) {
      writer.uint32(8).uint32(message.x);
    }
    if (message.y !== 0) {
      writer.uint32(16).uint32(message.y);
    }
    if (message.width !== 0) {
      writer.uint32(24).uint32(message.width);
    }
    if (message.height !== 0) {
      writer.uint32(32).uint32(message.height);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Box {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBox();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.x = reader.uint32();
          break;
        case 2:
          message.y = reader.uint32();
          break;
        case 3:
          message.width = reader.uint32();
          break;
        case 4:
          message.height = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Box {
    return {
      x: isSet(object.x) ? Number(object.x) : 0,
      y: isSet(object.y) ? Number(object.y) : 0,
      width: isSet(object.width) ? Number(object.width) : 0,
      height: isSet(object.height) ? Number(object.height) : 0,
    };
  },

  toJSON(message: Box): unknown {
    const obj: any = {};
    message.x !== undefined && (obj.x = Math.round(message.x));
    message.y !== undefined && (obj.y = Math.round(message.y));
    message.width !== undefined && (obj.width = Math.round(message.width));
    message.height !== undefined && (obj.height = Math.round(message.height));
    return obj;
  },

  create<I extends Exact<DeepPartial<Box>, I>>(base?: I): Box {
    return Box.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Box>, I>>(object: I): Box {
    const message = createBaseBox();
    message.x = object.x ?? 0;
    message.y = object.y ?? 0;
    message.width = object.width ?? 0;
    message.height = object.height ?? 0;
    return message;
  },
};

function createBaseSpriteInfo(): SpriteInfo {
  return {
    patternWidth: 0,
    patternHeight: 0,
    patternDepth: 0,
    layers: 0,
    spriteId: [],
    boundingSquare: 0,
    animation: undefined,
    isOpaque: false,
    boundingBoxPerDirection: [],
  };
}

export const SpriteInfo = {
  encode(message: SpriteInfo, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.patternWidth !== 0) {
      writer.uint32(8).uint32(message.patternWidth);
    }
    if (message.patternHeight !== 0) {
      writer.uint32(16).uint32(message.patternHeight);
    }
    if (message.patternDepth !== 0) {
      writer.uint32(24).uint32(message.patternDepth);
    }
    if (message.layers !== 0) {
      writer.uint32(32).uint32(message.layers);
    }
    writer.uint32(42).fork();
    for (const v of message.spriteId) {
      writer.uint32(v);
    }
    writer.ldelim();
    if (message.boundingSquare !== 0) {
      writer.uint32(56).uint32(message.boundingSquare);
    }
    if (message.animation !== undefined) {
      SpriteAnimation.encode(message.animation, writer.uint32(50).fork()).ldelim();
    }
    if (message.isOpaque === true) {
      writer.uint32(64).bool(message.isOpaque);
    }
    for (const v of message.boundingBoxPerDirection) {
      Box.encode(v!, writer.uint32(74).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SpriteInfo {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSpriteInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.patternWidth = reader.uint32();
          break;
        case 2:
          message.patternHeight = reader.uint32();
          break;
        case 3:
          message.patternDepth = reader.uint32();
          break;
        case 4:
          message.layers = reader.uint32();
          break;
        case 5:
          if ((tag & 7) === 2) {
            const end2 = reader.uint32() + reader.pos;
            while (reader.pos < end2) {
              message.spriteId.push(reader.uint32());
            }
          } else {
            message.spriteId.push(reader.uint32());
          }
          break;
        case 7:
          message.boundingSquare = reader.uint32();
          break;
        case 6:
          message.animation = SpriteAnimation.decode(reader, reader.uint32());
          break;
        case 8:
          message.isOpaque = reader.bool();
          break;
        case 9:
          message.boundingBoxPerDirection.push(Box.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SpriteInfo {
    return {
      patternWidth: isSet(object.patternWidth) ? Number(object.patternWidth) : 0,
      patternHeight: isSet(object.patternHeight) ? Number(object.patternHeight) : 0,
      patternDepth: isSet(object.patternDepth) ? Number(object.patternDepth) : 0,
      layers: isSet(object.layers) ? Number(object.layers) : 0,
      spriteId: Array.isArray(object?.spriteId) ? object.spriteId.map((e: any) => Number(e)) : [],
      boundingSquare: isSet(object.boundingSquare) ? Number(object.boundingSquare) : 0,
      animation: isSet(object.animation) ? SpriteAnimation.fromJSON(object.animation) : undefined,
      isOpaque: isSet(object.isOpaque) ? Boolean(object.isOpaque) : false,
      boundingBoxPerDirection: Array.isArray(object?.boundingBoxPerDirection)
        ? object.boundingBoxPerDirection.map((e: any) => Box.fromJSON(e))
        : [],
    };
  },

  toJSON(message: SpriteInfo): unknown {
    const obj: any = {};
    message.patternWidth !== undefined && (obj.patternWidth = Math.round(message.patternWidth));
    message.patternHeight !== undefined && (obj.patternHeight = Math.round(message.patternHeight));
    message.patternDepth !== undefined && (obj.patternDepth = Math.round(message.patternDepth));
    message.layers !== undefined && (obj.layers = Math.round(message.layers));
    if (message.spriteId) {
      obj.spriteId = message.spriteId.map((e) => Math.round(e));
    } else {
      obj.spriteId = [];
    }
    message.boundingSquare !== undefined && (obj.boundingSquare = Math.round(message.boundingSquare));
    message.animation !== undefined &&
      (obj.animation = message.animation ? SpriteAnimation.toJSON(message.animation) : undefined);
    message.isOpaque !== undefined && (obj.isOpaque = message.isOpaque);
    if (message.boundingBoxPerDirection) {
      obj.boundingBoxPerDirection = message.boundingBoxPerDirection.map((e) => e ? Box.toJSON(e) : undefined);
    } else {
      obj.boundingBoxPerDirection = [];
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<SpriteInfo>, I>>(base?: I): SpriteInfo {
    return SpriteInfo.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<SpriteInfo>, I>>(object: I): SpriteInfo {
    const message = createBaseSpriteInfo();
    message.patternWidth = object.patternWidth ?? 0;
    message.patternHeight = object.patternHeight ?? 0;
    message.patternDepth = object.patternDepth ?? 0;
    message.layers = object.layers ?? 0;
    message.spriteId = object.spriteId?.map((e) => e) || [];
    message.boundingSquare = object.boundingSquare ?? 0;
    message.animation = (object.animation !== undefined && object.animation !== null)
      ? SpriteAnimation.fromPartial(object.animation)
      : undefined;
    message.isOpaque = object.isOpaque ?? false;
    message.boundingBoxPerDirection = object.boundingBoxPerDirection?.map((e) => Box.fromPartial(e)) || [];
    return message;
  },
};

function createBaseFrameGroup(): FrameGroup {
  return { fixedFrameGroup: 0, id: 0, spriteInfo: undefined };
}

export const FrameGroup = {
  encode(message: FrameGroup, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.fixedFrameGroup !== 0) {
      writer.uint32(8).int32(message.fixedFrameGroup);
    }
    if (message.id !== 0) {
      writer.uint32(16).uint32(message.id);
    }
    if (message.spriteInfo !== undefined) {
      SpriteInfo.encode(message.spriteInfo, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): FrameGroup {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseFrameGroup();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.fixedFrameGroup = reader.int32() as any;
          break;
        case 2:
          message.id = reader.uint32();
          break;
        case 3:
          message.spriteInfo = SpriteInfo.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): FrameGroup {
    return {
      fixedFrameGroup: isSet(object.fixedFrameGroup) ? fixedFrameGroupFromJSON(object.fixedFrameGroup) : 0,
      id: isSet(object.id) ? Number(object.id) : 0,
      spriteInfo: isSet(object.spriteInfo) ? SpriteInfo.fromJSON(object.spriteInfo) : undefined,
    };
  },

  toJSON(message: FrameGroup): unknown {
    const obj: any = {};
    message.fixedFrameGroup !== undefined && (obj.fixedFrameGroup = fixedFrameGroupToJSON(message.fixedFrameGroup));
    message.id !== undefined && (obj.id = Math.round(message.id));
    message.spriteInfo !== undefined &&
      (obj.spriteInfo = message.spriteInfo ? SpriteInfo.toJSON(message.spriteInfo) : undefined);
    return obj;
  },

  create<I extends Exact<DeepPartial<FrameGroup>, I>>(base?: I): FrameGroup {
    return FrameGroup.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<FrameGroup>, I>>(object: I): FrameGroup {
    const message = createBaseFrameGroup();
    message.fixedFrameGroup = object.fixedFrameGroup ?? 0;
    message.id = object.id ?? 0;
    message.spriteInfo = (object.spriteInfo !== undefined && object.spriteInfo !== null)
      ? SpriteInfo.fromPartial(object.spriteInfo)
      : undefined;
    return message;
  },
};

function createBaseAppearance(): Appearance {
  return { id: 0, frameGroup: [], flags: undefined, name: "", description: "" };
}

export const Appearance = {
  encode(message: Appearance, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== 0) {
      writer.uint32(8).uint32(message.id);
    }
    for (const v of message.frameGroup) {
      FrameGroup.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    if (message.flags !== undefined) {
      AppearanceFlags.encode(message.flags, writer.uint32(26).fork()).ldelim();
    }
    if (message.name !== "") {
      writer.uint32(34).string(message.name);
    }
    if (message.description !== "") {
      writer.uint32(42).string(message.description);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Appearance {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearance();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = reader.uint32();
          break;
        case 2:
          message.frameGroup.push(FrameGroup.decode(reader, reader.uint32()));
          break;
        case 3:
          message.flags = AppearanceFlags.decode(reader, reader.uint32());
          break;
        case 4:
          message.name = reader.string();
          break;
        case 5:
          message.description = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Appearance {
    return {
      id: isSet(object.id) ? Number(object.id) : 0,
      frameGroup: Array.isArray(object?.frameGroup) ? object.frameGroup.map((e: any) => FrameGroup.fromJSON(e)) : [],
      flags: isSet(object.flags) ? AppearanceFlags.fromJSON(object.flags) : undefined,
      name: isSet(object.name) ? String(object.name) : "",
      description: isSet(object.description) ? String(object.description) : "",
    };
  },

  toJSON(message: Appearance): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = Math.round(message.id));
    if (message.frameGroup) {
      obj.frameGroup = message.frameGroup.map((e) => e ? FrameGroup.toJSON(e) : undefined);
    } else {
      obj.frameGroup = [];
    }
    message.flags !== undefined && (obj.flags = message.flags ? AppearanceFlags.toJSON(message.flags) : undefined);
    message.name !== undefined && (obj.name = message.name);
    message.description !== undefined && (obj.description = message.description);
    return obj;
  },

  create<I extends Exact<DeepPartial<Appearance>, I>>(base?: I): Appearance {
    return Appearance.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Appearance>, I>>(object: I): Appearance {
    const message = createBaseAppearance();
    message.id = object.id ?? 0;
    message.frameGroup = object.frameGroup?.map((e) => FrameGroup.fromPartial(e)) || [];
    message.flags = (object.flags !== undefined && object.flags !== null)
      ? AppearanceFlags.fromPartial(object.flags)
      : undefined;
    message.name = object.name ?? "";
    message.description = object.description ?? "";
    return message;
  },
};

function createBaseAppearanceFlags(): AppearanceFlags {
  return {
    bank: undefined,
    clip: false,
    bottom: false,
    top: false,
    container: false,
    cumulative: false,
    usable: false,
    forceuse: false,
    multiuse: false,
    write: undefined,
    writeOnce: undefined,
    liquidpool: false,
    unpass: false,
    unmove: false,
    unsight: false,
    avoid: false,
    noMovementAnimation: false,
    take: false,
    liquidcontainer: false,
    hang: false,
    hook: undefined,
    rotate: false,
    light: undefined,
    dontHide: false,
    translucent: false,
    shift: undefined,
    height: undefined,
    lyingObject: false,
    animateAlways: false,
    automap: undefined,
    lenshelp: undefined,
    fullbank: false,
    ignoreLook: false,
    clothes: undefined,
    defaultAction: undefined,
    market: undefined,
    wrap: false,
    unwrap: false,
    topeffect: false,
    npcsaledata: [],
    changedtoexpire: undefined,
    corpse: false,
    playerCorpse: false,
    cyclopediaitem: undefined,
    ammo: false,
    showOffSocket: false,
    reportable: false,
    upgradeclassification: undefined,
    reverseAddonsEast: false,
    reverseAddonsWest: false,
    reverseAddonsSouth: false,
    reverseAddonsNorth: false,
    wearout: false,
    clockexpire: false,
    expire: false,
    expirestop: false,
    decoKit: false,
    skillwheelGem: undefined,
    dualWielding: false,
    hookSouth: false,
    hookEast: false,
    transparencylevel: undefined,
  };
}

export const AppearanceFlags = {
  encode(message: AppearanceFlags, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.bank !== undefined) {
      AppearanceFlagBank.encode(message.bank, writer.uint32(10).fork()).ldelim();
    }
    if (message.clip === true) {
      writer.uint32(16).bool(message.clip);
    }
    if (message.bottom === true) {
      writer.uint32(24).bool(message.bottom);
    }
    if (message.top === true) {
      writer.uint32(32).bool(message.top);
    }
    if (message.container === true) {
      writer.uint32(40).bool(message.container);
    }
    if (message.cumulative === true) {
      writer.uint32(48).bool(message.cumulative);
    }
    if (message.usable === true) {
      writer.uint32(56).bool(message.usable);
    }
    if (message.forceuse === true) {
      writer.uint32(64).bool(message.forceuse);
    }
    if (message.multiuse === true) {
      writer.uint32(72).bool(message.multiuse);
    }
    if (message.write !== undefined) {
      AppearanceFlagWrite.encode(message.write, writer.uint32(82).fork()).ldelim();
    }
    if (message.writeOnce !== undefined) {
      AppearanceFlagWriteOnce.encode(message.writeOnce, writer.uint32(90).fork()).ldelim();
    }
    if (message.liquidpool === true) {
      writer.uint32(96).bool(message.liquidpool);
    }
    if (message.unpass === true) {
      writer.uint32(104).bool(message.unpass);
    }
    if (message.unmove === true) {
      writer.uint32(112).bool(message.unmove);
    }
    if (message.unsight === true) {
      writer.uint32(120).bool(message.unsight);
    }
    if (message.avoid === true) {
      writer.uint32(128).bool(message.avoid);
    }
    if (message.noMovementAnimation === true) {
      writer.uint32(136).bool(message.noMovementAnimation);
    }
    if (message.take === true) {
      writer.uint32(144).bool(message.take);
    }
    if (message.liquidcontainer === true) {
      writer.uint32(152).bool(message.liquidcontainer);
    }
    if (message.hang === true) {
      writer.uint32(160).bool(message.hang);
    }
    if (message.hook !== undefined) {
      AppearanceFlagHook.encode(message.hook, writer.uint32(170).fork()).ldelim();
    }
    if (message.rotate === true) {
      writer.uint32(176).bool(message.rotate);
    }
    if (message.light !== undefined) {
      AppearanceFlagLight.encode(message.light, writer.uint32(186).fork()).ldelim();
    }
    if (message.dontHide === true) {
      writer.uint32(192).bool(message.dontHide);
    }
    if (message.translucent === true) {
      writer.uint32(200).bool(message.translucent);
    }
    if (message.shift !== undefined) {
      AppearanceFlagShift.encode(message.shift, writer.uint32(210).fork()).ldelim();
    }
    if (message.height !== undefined) {
      AppearanceFlagHeight.encode(message.height, writer.uint32(218).fork()).ldelim();
    }
    if (message.lyingObject === true) {
      writer.uint32(224).bool(message.lyingObject);
    }
    if (message.animateAlways === true) {
      writer.uint32(232).bool(message.animateAlways);
    }
    if (message.automap !== undefined) {
      AppearanceFlagAutomap.encode(message.automap, writer.uint32(242).fork()).ldelim();
    }
    if (message.lenshelp !== undefined) {
      AppearanceFlagLenshelp.encode(message.lenshelp, writer.uint32(250).fork()).ldelim();
    }
    if (message.fullbank === true) {
      writer.uint32(256).bool(message.fullbank);
    }
    if (message.ignoreLook === true) {
      writer.uint32(264).bool(message.ignoreLook);
    }
    if (message.clothes !== undefined) {
      AppearanceFlagClothes.encode(message.clothes, writer.uint32(274).fork()).ldelim();
    }
    if (message.defaultAction !== undefined) {
      AppearanceFlagDefaultAction.encode(message.defaultAction, writer.uint32(282).fork()).ldelim();
    }
    if (message.market !== undefined) {
      AppearanceFlagMarket.encode(message.market, writer.uint32(290).fork()).ldelim();
    }
    if (message.wrap === true) {
      writer.uint32(296).bool(message.wrap);
    }
    if (message.unwrap === true) {
      writer.uint32(304).bool(message.unwrap);
    }
    if (message.topeffect === true) {
      writer.uint32(312).bool(message.topeffect);
    }
    for (const v of message.npcsaledata) {
      AppearanceFlagNPC.encode(v!, writer.uint32(322).fork()).ldelim();
    }
    if (message.changedtoexpire !== undefined) {
      AppearanceFlagChangedToExpire.encode(message.changedtoexpire, writer.uint32(330).fork()).ldelim();
    }
    if (message.corpse === true) {
      writer.uint32(336).bool(message.corpse);
    }
    if (message.playerCorpse === true) {
      writer.uint32(344).bool(message.playerCorpse);
    }
    if (message.cyclopediaitem !== undefined) {
      AppearanceFlagCyclopedia.encode(message.cyclopediaitem, writer.uint32(354).fork()).ldelim();
    }
    if (message.ammo === true) {
      writer.uint32(360).bool(message.ammo);
    }
    if (message.showOffSocket === true) {
      writer.uint32(368).bool(message.showOffSocket);
    }
    if (message.reportable === true) {
      writer.uint32(376).bool(message.reportable);
    }
    if (message.upgradeclassification !== undefined) {
      AppearanceFlagUpgradeClassification.encode(message.upgradeclassification, writer.uint32(386).fork()).ldelim();
    }
    if (message.reverseAddonsEast === true) {
      writer.uint32(392).bool(message.reverseAddonsEast);
    }
    if (message.reverseAddonsWest === true) {
      writer.uint32(400).bool(message.reverseAddonsWest);
    }
    if (message.reverseAddonsSouth === true) {
      writer.uint32(408).bool(message.reverseAddonsSouth);
    }
    if (message.reverseAddonsNorth === true) {
      writer.uint32(416).bool(message.reverseAddonsNorth);
    }
    if (message.wearout === true) {
      writer.uint32(424).bool(message.wearout);
    }
    if (message.clockexpire === true) {
      writer.uint32(432).bool(message.clockexpire);
    }
    if (message.expire === true) {
      writer.uint32(440).bool(message.expire);
    }
    if (message.expirestop === true) {
      writer.uint32(448).bool(message.expirestop);
    }
    if (message.decoKit === true) {
      writer.uint32(456).bool(message.decoKit);
    }
    if (message.skillwheelGem !== undefined) {
      AppearanceFlagSkillWheelGem.encode(message.skillwheelGem, writer.uint32(466).fork()).ldelim();
    }
    if (message.dualWielding === true) {
      writer.uint32(472).bool(message.dualWielding);
    }
    if (message.hookSouth === true) {
      writer.uint32(560).bool(message.hookSouth);
    }
    if (message.hookEast === true) {
      writer.uint32(568).bool(message.hookEast);
    }
    if (message.transparencylevel !== undefined) {
      AppearanceFlagTransparencyLevel.encode(message.transparencylevel, writer.uint32(578).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AppearanceFlags {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearanceFlags();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.bank = AppearanceFlagBank.decode(reader, reader.uint32());
          break;
        case 2:
          message.clip = reader.bool();
          break;
        case 3:
          message.bottom = reader.bool();
          break;
        case 4:
          message.top = reader.bool();
          break;
        case 5:
          message.container = reader.bool();
          break;
        case 6:
          message.cumulative = reader.bool();
          break;
        case 7:
          message.usable = reader.bool();
          break;
        case 8:
          message.forceuse = reader.bool();
          break;
        case 9:
          message.multiuse = reader.bool();
          break;
        case 10:
          message.write = AppearanceFlagWrite.decode(reader, reader.uint32());
          break;
        case 11:
          message.writeOnce = AppearanceFlagWriteOnce.decode(reader, reader.uint32());
          break;
        case 12:
          message.liquidpool = reader.bool();
          break;
        case 13:
          message.unpass = reader.bool();
          break;
        case 14:
          message.unmove = reader.bool();
          break;
        case 15:
          message.unsight = reader.bool();
          break;
        case 16:
          message.avoid = reader.bool();
          break;
        case 17:
          message.noMovementAnimation = reader.bool();
          break;
        case 18:
          message.take = reader.bool();
          break;
        case 19:
          message.liquidcontainer = reader.bool();
          break;
        case 20:
          message.hang = reader.bool();
          break;
        case 21:
          message.hook = AppearanceFlagHook.decode(reader, reader.uint32());
          break;
        case 22:
          message.rotate = reader.bool();
          break;
        case 23:
          message.light = AppearanceFlagLight.decode(reader, reader.uint32());
          break;
        case 24:
          message.dontHide = reader.bool();
          break;
        case 25:
          message.translucent = reader.bool();
          break;
        case 26:
          message.shift = AppearanceFlagShift.decode(reader, reader.uint32());
          break;
        case 27:
          message.height = AppearanceFlagHeight.decode(reader, reader.uint32());
          break;
        case 28:
          message.lyingObject = reader.bool();
          break;
        case 29:
          message.animateAlways = reader.bool();
          break;
        case 30:
          message.automap = AppearanceFlagAutomap.decode(reader, reader.uint32());
          break;
        case 31:
          message.lenshelp = AppearanceFlagLenshelp.decode(reader, reader.uint32());
          break;
        case 32:
          message.fullbank = reader.bool();
          break;
        case 33:
          message.ignoreLook = reader.bool();
          break;
        case 34:
          message.clothes = AppearanceFlagClothes.decode(reader, reader.uint32());
          break;
        case 35:
          message.defaultAction = AppearanceFlagDefaultAction.decode(reader, reader.uint32());
          break;
        case 36:
          message.market = AppearanceFlagMarket.decode(reader, reader.uint32());
          break;
        case 37:
          message.wrap = reader.bool();
          break;
        case 38:
          message.unwrap = reader.bool();
          break;
        case 39:
          message.topeffect = reader.bool();
          break;
        case 40:
          message.npcsaledata.push(AppearanceFlagNPC.decode(reader, reader.uint32()));
          break;
        case 41:
          message.changedtoexpire = AppearanceFlagChangedToExpire.decode(reader, reader.uint32());
          break;
        case 42:
          message.corpse = reader.bool();
          break;
        case 43:
          message.playerCorpse = reader.bool();
          break;
        case 44:
          message.cyclopediaitem = AppearanceFlagCyclopedia.decode(reader, reader.uint32());
          break;
        case 45:
          message.ammo = reader.bool();
          break;
        case 46:
          message.showOffSocket = reader.bool();
          break;
        case 47:
          message.reportable = reader.bool();
          break;
        case 48:
          message.upgradeclassification = AppearanceFlagUpgradeClassification.decode(reader, reader.uint32());
          break;
        case 49:
          message.reverseAddonsEast = reader.bool();
          break;
        case 50:
          message.reverseAddonsWest = reader.bool();
          break;
        case 51:
          message.reverseAddonsSouth = reader.bool();
          break;
        case 52:
          message.reverseAddonsNorth = reader.bool();
          break;
        case 53:
          message.wearout = reader.bool();
          break;
        case 54:
          message.clockexpire = reader.bool();
          break;
        case 55:
          message.expire = reader.bool();
          break;
        case 56:
          message.expirestop = reader.bool();
          break;
        case 57:
          message.decoKit = reader.bool();
          break;
        case 58:
          message.skillwheelGem = AppearanceFlagSkillWheelGem.decode(reader, reader.uint32());
          break;
        case 59:
          message.dualWielding = reader.bool();
          break;
        case 70:
          message.hookSouth = reader.bool();
          break;
        case 71:
          message.hookEast = reader.bool();
          break;
        case 72:
          message.transparencylevel = AppearanceFlagTransparencyLevel.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AppearanceFlags {
    return {
      bank: isSet(object.bank) ? AppearanceFlagBank.fromJSON(object.bank) : undefined,
      clip: isSet(object.clip) ? Boolean(object.clip) : false,
      bottom: isSet(object.bottom) ? Boolean(object.bottom) : false,
      top: isSet(object.top) ? Boolean(object.top) : false,
      container: isSet(object.container) ? Boolean(object.container) : false,
      cumulative: isSet(object.cumulative) ? Boolean(object.cumulative) : false,
      usable: isSet(object.usable) ? Boolean(object.usable) : false,
      forceuse: isSet(object.forceuse) ? Boolean(object.forceuse) : false,
      multiuse: isSet(object.multiuse) ? Boolean(object.multiuse) : false,
      write: isSet(object.write) ? AppearanceFlagWrite.fromJSON(object.write) : undefined,
      writeOnce: isSet(object.writeOnce) ? AppearanceFlagWriteOnce.fromJSON(object.writeOnce) : undefined,
      liquidpool: isSet(object.liquidpool) ? Boolean(object.liquidpool) : false,
      unpass: isSet(object.unpass) ? Boolean(object.unpass) : false,
      unmove: isSet(object.unmove) ? Boolean(object.unmove) : false,
      unsight: isSet(object.unsight) ? Boolean(object.unsight) : false,
      avoid: isSet(object.avoid) ? Boolean(object.avoid) : false,
      noMovementAnimation: isSet(object.noMovementAnimation) ? Boolean(object.noMovementAnimation) : false,
      take: isSet(object.take) ? Boolean(object.take) : false,
      liquidcontainer: isSet(object.liquidcontainer) ? Boolean(object.liquidcontainer) : false,
      hang: isSet(object.hang) ? Boolean(object.hang) : false,
      hook: isSet(object.hook) ? AppearanceFlagHook.fromJSON(object.hook) : undefined,
      rotate: isSet(object.rotate) ? Boolean(object.rotate) : false,
      light: isSet(object.light) ? AppearanceFlagLight.fromJSON(object.light) : undefined,
      dontHide: isSet(object.dontHide) ? Boolean(object.dontHide) : false,
      translucent: isSet(object.translucent) ? Boolean(object.translucent) : false,
      shift: isSet(object.shift) ? AppearanceFlagShift.fromJSON(object.shift) : undefined,
      height: isSet(object.height) ? AppearanceFlagHeight.fromJSON(object.height) : undefined,
      lyingObject: isSet(object.lyingObject) ? Boolean(object.lyingObject) : false,
      animateAlways: isSet(object.animateAlways) ? Boolean(object.animateAlways) : false,
      automap: isSet(object.automap) ? AppearanceFlagAutomap.fromJSON(object.automap) : undefined,
      lenshelp: isSet(object.lenshelp) ? AppearanceFlagLenshelp.fromJSON(object.lenshelp) : undefined,
      fullbank: isSet(object.fullbank) ? Boolean(object.fullbank) : false,
      ignoreLook: isSet(object.ignoreLook) ? Boolean(object.ignoreLook) : false,
      clothes: isSet(object.clothes) ? AppearanceFlagClothes.fromJSON(object.clothes) : undefined,
      defaultAction: isSet(object.defaultAction)
        ? AppearanceFlagDefaultAction.fromJSON(object.defaultAction)
        : undefined,
      market: isSet(object.market) ? AppearanceFlagMarket.fromJSON(object.market) : undefined,
      wrap: isSet(object.wrap) ? Boolean(object.wrap) : false,
      unwrap: isSet(object.unwrap) ? Boolean(object.unwrap) : false,
      topeffect: isSet(object.topeffect) ? Boolean(object.topeffect) : false,
      npcsaledata: Array.isArray(object?.npcsaledata)
        ? object.npcsaledata.map((e: any) => AppearanceFlagNPC.fromJSON(e))
        : [],
      changedtoexpire: isSet(object.changedtoexpire)
        ? AppearanceFlagChangedToExpire.fromJSON(object.changedtoexpire)
        : undefined,
      corpse: isSet(object.corpse) ? Boolean(object.corpse) : false,
      playerCorpse: isSet(object.playerCorpse) ? Boolean(object.playerCorpse) : false,
      cyclopediaitem: isSet(object.cyclopediaitem)
        ? AppearanceFlagCyclopedia.fromJSON(object.cyclopediaitem)
        : undefined,
      ammo: isSet(object.ammo) ? Boolean(object.ammo) : false,
      showOffSocket: isSet(object.showOffSocket) ? Boolean(object.showOffSocket) : false,
      reportable: isSet(object.reportable) ? Boolean(object.reportable) : false,
      upgradeclassification: isSet(object.upgradeclassification)
        ? AppearanceFlagUpgradeClassification.fromJSON(object.upgradeclassification)
        : undefined,
      reverseAddonsEast: isSet(object.reverseAddonsEast) ? Boolean(object.reverseAddonsEast) : false,
      reverseAddonsWest: isSet(object.reverseAddonsWest) ? Boolean(object.reverseAddonsWest) : false,
      reverseAddonsSouth: isSet(object.reverseAddonsSouth) ? Boolean(object.reverseAddonsSouth) : false,
      reverseAddonsNorth: isSet(object.reverseAddonsNorth) ? Boolean(object.reverseAddonsNorth) : false,
      wearout: isSet(object.wearout) ? Boolean(object.wearout) : false,
      clockexpire: isSet(object.clockexpire) ? Boolean(object.clockexpire) : false,
      expire: isSet(object.expire) ? Boolean(object.expire) : false,
      expirestop: isSet(object.expirestop) ? Boolean(object.expirestop) : false,
      decoKit: isSet(object.decoKit) ? Boolean(object.decoKit) : false,
      skillwheelGem: isSet(object.skillwheelGem)
        ? AppearanceFlagSkillWheelGem.fromJSON(object.skillwheelGem)
        : undefined,
      dualWielding: isSet(object.dualWielding) ? Boolean(object.dualWielding) : false,
      hookSouth: isSet(object.hookSouth) ? Boolean(object.hookSouth) : false,
      hookEast: isSet(object.hookEast) ? Boolean(object.hookEast) : false,
      transparencylevel: isSet(object.transparencylevel)
        ? AppearanceFlagTransparencyLevel.fromJSON(object.transparencylevel)
        : undefined,
    };
  },

  toJSON(message: AppearanceFlags): unknown {
    const obj: any = {};
    message.bank !== undefined && (obj.bank = message.bank ? AppearanceFlagBank.toJSON(message.bank) : undefined);
    message.clip !== undefined && (obj.clip = message.clip);
    message.bottom !== undefined && (obj.bottom = message.bottom);
    message.top !== undefined && (obj.top = message.top);
    message.container !== undefined && (obj.container = message.container);
    message.cumulative !== undefined && (obj.cumulative = message.cumulative);
    message.usable !== undefined && (obj.usable = message.usable);
    message.forceuse !== undefined && (obj.forceuse = message.forceuse);
    message.multiuse !== undefined && (obj.multiuse = message.multiuse);
    message.write !== undefined && (obj.write = message.write ? AppearanceFlagWrite.toJSON(message.write) : undefined);
    message.writeOnce !== undefined &&
      (obj.writeOnce = message.writeOnce ? AppearanceFlagWriteOnce.toJSON(message.writeOnce) : undefined);
    message.liquidpool !== undefined && (obj.liquidpool = message.liquidpool);
    message.unpass !== undefined && (obj.unpass = message.unpass);
    message.unmove !== undefined && (obj.unmove = message.unmove);
    message.unsight !== undefined && (obj.unsight = message.unsight);
    message.avoid !== undefined && (obj.avoid = message.avoid);
    message.noMovementAnimation !== undefined && (obj.noMovementAnimation = message.noMovementAnimation);
    message.take !== undefined && (obj.take = message.take);
    message.liquidcontainer !== undefined && (obj.liquidcontainer = message.liquidcontainer);
    message.hang !== undefined && (obj.hang = message.hang);
    message.hook !== undefined && (obj.hook = message.hook ? AppearanceFlagHook.toJSON(message.hook) : undefined);
    message.rotate !== undefined && (obj.rotate = message.rotate);
    message.light !== undefined && (obj.light = message.light ? AppearanceFlagLight.toJSON(message.light) : undefined);
    message.dontHide !== undefined && (obj.dontHide = message.dontHide);
    message.translucent !== undefined && (obj.translucent = message.translucent);
    message.shift !== undefined && (obj.shift = message.shift ? AppearanceFlagShift.toJSON(message.shift) : undefined);
    message.height !== undefined &&
      (obj.height = message.height ? AppearanceFlagHeight.toJSON(message.height) : undefined);
    message.lyingObject !== undefined && (obj.lyingObject = message.lyingObject);
    message.animateAlways !== undefined && (obj.animateAlways = message.animateAlways);
    message.automap !== undefined &&
      (obj.automap = message.automap ? AppearanceFlagAutomap.toJSON(message.automap) : undefined);
    message.lenshelp !== undefined &&
      (obj.lenshelp = message.lenshelp ? AppearanceFlagLenshelp.toJSON(message.lenshelp) : undefined);
    message.fullbank !== undefined && (obj.fullbank = message.fullbank);
    message.ignoreLook !== undefined && (obj.ignoreLook = message.ignoreLook);
    message.clothes !== undefined &&
      (obj.clothes = message.clothes ? AppearanceFlagClothes.toJSON(message.clothes) : undefined);
    message.defaultAction !== undefined &&
      (obj.defaultAction = message.defaultAction
        ? AppearanceFlagDefaultAction.toJSON(message.defaultAction)
        : undefined);
    message.market !== undefined &&
      (obj.market = message.market ? AppearanceFlagMarket.toJSON(message.market) : undefined);
    message.wrap !== undefined && (obj.wrap = message.wrap);
    message.unwrap !== undefined && (obj.unwrap = message.unwrap);
    message.topeffect !== undefined && (obj.topeffect = message.topeffect);
    if (message.npcsaledata) {
      obj.npcsaledata = message.npcsaledata.map((e) => e ? AppearanceFlagNPC.toJSON(e) : undefined);
    } else {
      obj.npcsaledata = [];
    }
    message.changedtoexpire !== undefined && (obj.changedtoexpire = message.changedtoexpire
      ? AppearanceFlagChangedToExpire.toJSON(message.changedtoexpire)
      : undefined);
    message.corpse !== undefined && (obj.corpse = message.corpse);
    message.playerCorpse !== undefined && (obj.playerCorpse = message.playerCorpse);
    message.cyclopediaitem !== undefined &&
      (obj.cyclopediaitem = message.cyclopediaitem
        ? AppearanceFlagCyclopedia.toJSON(message.cyclopediaitem)
        : undefined);
    message.ammo !== undefined && (obj.ammo = message.ammo);
    message.showOffSocket !== undefined && (obj.showOffSocket = message.showOffSocket);
    message.reportable !== undefined && (obj.reportable = message.reportable);
    message.upgradeclassification !== undefined && (obj.upgradeclassification = message.upgradeclassification
      ? AppearanceFlagUpgradeClassification.toJSON(message.upgradeclassification)
      : undefined);
    message.reverseAddonsEast !== undefined && (obj.reverseAddonsEast = message.reverseAddonsEast);
    message.reverseAddonsWest !== undefined && (obj.reverseAddonsWest = message.reverseAddonsWest);
    message.reverseAddonsSouth !== undefined && (obj.reverseAddonsSouth = message.reverseAddonsSouth);
    message.reverseAddonsNorth !== undefined && (obj.reverseAddonsNorth = message.reverseAddonsNorth);
    message.wearout !== undefined && (obj.wearout = message.wearout);
    message.clockexpire !== undefined && (obj.clockexpire = message.clockexpire);
    message.expire !== undefined && (obj.expire = message.expire);
    message.expirestop !== undefined && (obj.expirestop = message.expirestop);
    message.decoKit !== undefined && (obj.decoKit = message.decoKit);
    message.skillwheelGem !== undefined &&
      (obj.skillwheelGem = message.skillwheelGem
        ? AppearanceFlagSkillWheelGem.toJSON(message.skillwheelGem)
        : undefined);
    message.dualWielding !== undefined && (obj.dualWielding = message.dualWielding);
    message.hookSouth !== undefined && (obj.hookSouth = message.hookSouth);
    message.hookEast !== undefined && (obj.hookEast = message.hookEast);
    message.transparencylevel !== undefined && (obj.transparencylevel = message.transparencylevel
      ? AppearanceFlagTransparencyLevel.toJSON(message.transparencylevel)
      : undefined);
    return obj;
  },

  create<I extends Exact<DeepPartial<AppearanceFlags>, I>>(base?: I): AppearanceFlags {
    return AppearanceFlags.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<AppearanceFlags>, I>>(object: I): AppearanceFlags {
    const message = createBaseAppearanceFlags();
    message.bank = (object.bank !== undefined && object.bank !== null)
      ? AppearanceFlagBank.fromPartial(object.bank)
      : undefined;
    message.clip = object.clip ?? false;
    message.bottom = object.bottom ?? false;
    message.top = object.top ?? false;
    message.container = object.container ?? false;
    message.cumulative = object.cumulative ?? false;
    message.usable = object.usable ?? false;
    message.forceuse = object.forceuse ?? false;
    message.multiuse = object.multiuse ?? false;
    message.write = (object.write !== undefined && object.write !== null)
      ? AppearanceFlagWrite.fromPartial(object.write)
      : undefined;
    message.writeOnce = (object.writeOnce !== undefined && object.writeOnce !== null)
      ? AppearanceFlagWriteOnce.fromPartial(object.writeOnce)
      : undefined;
    message.liquidpool = object.liquidpool ?? false;
    message.unpass = object.unpass ?? false;
    message.unmove = object.unmove ?? false;
    message.unsight = object.unsight ?? false;
    message.avoid = object.avoid ?? false;
    message.noMovementAnimation = object.noMovementAnimation ?? false;
    message.take = object.take ?? false;
    message.liquidcontainer = object.liquidcontainer ?? false;
    message.hang = object.hang ?? false;
    message.hook = (object.hook !== undefined && object.hook !== null)
      ? AppearanceFlagHook.fromPartial(object.hook)
      : undefined;
    message.rotate = object.rotate ?? false;
    message.light = (object.light !== undefined && object.light !== null)
      ? AppearanceFlagLight.fromPartial(object.light)
      : undefined;
    message.dontHide = object.dontHide ?? false;
    message.translucent = object.translucent ?? false;
    message.shift = (object.shift !== undefined && object.shift !== null)
      ? AppearanceFlagShift.fromPartial(object.shift)
      : undefined;
    message.height = (object.height !== undefined && object.height !== null)
      ? AppearanceFlagHeight.fromPartial(object.height)
      : undefined;
    message.lyingObject = object.lyingObject ?? false;
    message.animateAlways = object.animateAlways ?? false;
    message.automap = (object.automap !== undefined && object.automap !== null)
      ? AppearanceFlagAutomap.fromPartial(object.automap)
      : undefined;
    message.lenshelp = (object.lenshelp !== undefined && object.lenshelp !== null)
      ? AppearanceFlagLenshelp.fromPartial(object.lenshelp)
      : undefined;
    message.fullbank = object.fullbank ?? false;
    message.ignoreLook = object.ignoreLook ?? false;
    message.clothes = (object.clothes !== undefined && object.clothes !== null)
      ? AppearanceFlagClothes.fromPartial(object.clothes)
      : undefined;
    message.defaultAction = (object.defaultAction !== undefined && object.defaultAction !== null)
      ? AppearanceFlagDefaultAction.fromPartial(object.defaultAction)
      : undefined;
    message.market = (object.market !== undefined && object.market !== null)
      ? AppearanceFlagMarket.fromPartial(object.market)
      : undefined;
    message.wrap = object.wrap ?? false;
    message.unwrap = object.unwrap ?? false;
    message.topeffect = object.topeffect ?? false;
    message.npcsaledata = object.npcsaledata?.map((e) => AppearanceFlagNPC.fromPartial(e)) || [];
    message.changedtoexpire = (object.changedtoexpire !== undefined && object.changedtoexpire !== null)
      ? AppearanceFlagChangedToExpire.fromPartial(object.changedtoexpire)
      : undefined;
    message.corpse = object.corpse ?? false;
    message.playerCorpse = object.playerCorpse ?? false;
    message.cyclopediaitem = (object.cyclopediaitem !== undefined && object.cyclopediaitem !== null)
      ? AppearanceFlagCyclopedia.fromPartial(object.cyclopediaitem)
      : undefined;
    message.ammo = object.ammo ?? false;
    message.showOffSocket = object.showOffSocket ?? false;
    message.reportable = object.reportable ?? false;
    message.upgradeclassification =
      (object.upgradeclassification !== undefined && object.upgradeclassification !== null)
        ? AppearanceFlagUpgradeClassification.fromPartial(object.upgradeclassification)
        : undefined;
    message.reverseAddonsEast = object.reverseAddonsEast ?? false;
    message.reverseAddonsWest = object.reverseAddonsWest ?? false;
    message.reverseAddonsSouth = object.reverseAddonsSouth ?? false;
    message.reverseAddonsNorth = object.reverseAddonsNorth ?? false;
    message.wearout = object.wearout ?? false;
    message.clockexpire = object.clockexpire ?? false;
    message.expire = object.expire ?? false;
    message.expirestop = object.expirestop ?? false;
    message.decoKit = object.decoKit ?? false;
    message.skillwheelGem = (object.skillwheelGem !== undefined && object.skillwheelGem !== null)
      ? AppearanceFlagSkillWheelGem.fromPartial(object.skillwheelGem)
      : undefined;
    message.dualWielding = object.dualWielding ?? false;
    message.hookSouth = object.hookSouth ?? false;
    message.hookEast = object.hookEast ?? false;
    message.transparencylevel = (object.transparencylevel !== undefined && object.transparencylevel !== null)
      ? AppearanceFlagTransparencyLevel.fromPartial(object.transparencylevel)
      : undefined;
    return message;
  },
};

function createBaseAppearanceFlagUpgradeClassification(): AppearanceFlagUpgradeClassification {
  return { upgradeClassification: 0 };
}

export const AppearanceFlagUpgradeClassification = {
  encode(message: AppearanceFlagUpgradeClassification, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.upgradeClassification !== 0) {
      writer.uint32(8).uint32(message.upgradeClassification);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AppearanceFlagUpgradeClassification {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearanceFlagUpgradeClassification();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.upgradeClassification = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AppearanceFlagUpgradeClassification {
    return { upgradeClassification: isSet(object.upgradeClassification) ? Number(object.upgradeClassification) : 0 };
  },

  toJSON(message: AppearanceFlagUpgradeClassification): unknown {
    const obj: any = {};
    message.upgradeClassification !== undefined &&
      (obj.upgradeClassification = Math.round(message.upgradeClassification));
    return obj;
  },

  create<I extends Exact<DeepPartial<AppearanceFlagUpgradeClassification>, I>>(
    base?: I,
  ): AppearanceFlagUpgradeClassification {
    return AppearanceFlagUpgradeClassification.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<AppearanceFlagUpgradeClassification>, I>>(
    object: I,
  ): AppearanceFlagUpgradeClassification {
    const message = createBaseAppearanceFlagUpgradeClassification();
    message.upgradeClassification = object.upgradeClassification ?? 0;
    return message;
  },
};

function createBaseAppearanceFlagTransparencyLevel(): AppearanceFlagTransparencyLevel {
  return { level: 0 };
}

export const AppearanceFlagTransparencyLevel = {
  encode(message: AppearanceFlagTransparencyLevel, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.level !== 0) {
      writer.uint32(8).uint32(message.level);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AppearanceFlagTransparencyLevel {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearanceFlagTransparencyLevel();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.level = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AppearanceFlagTransparencyLevel {
    return { level: isSet(object.level) ? Number(object.level) : 0 };
  },

  toJSON(message: AppearanceFlagTransparencyLevel): unknown {
    const obj: any = {};
    message.level !== undefined && (obj.level = Math.round(message.level));
    return obj;
  },

  create<I extends Exact<DeepPartial<AppearanceFlagTransparencyLevel>, I>>(base?: I): AppearanceFlagTransparencyLevel {
    return AppearanceFlagTransparencyLevel.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<AppearanceFlagTransparencyLevel>, I>>(
    object: I,
  ): AppearanceFlagTransparencyLevel {
    const message = createBaseAppearanceFlagTransparencyLevel();
    message.level = object.level ?? 0;
    return message;
  },
};

function createBaseAppearanceFlagBank(): AppearanceFlagBank {
  return { waypoints: 0 };
}

export const AppearanceFlagBank = {
  encode(message: AppearanceFlagBank, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.waypoints !== 0) {
      writer.uint32(8).uint32(message.waypoints);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AppearanceFlagBank {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearanceFlagBank();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.waypoints = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AppearanceFlagBank {
    return { waypoints: isSet(object.waypoints) ? Number(object.waypoints) : 0 };
  },

  toJSON(message: AppearanceFlagBank): unknown {
    const obj: any = {};
    message.waypoints !== undefined && (obj.waypoints = Math.round(message.waypoints));
    return obj;
  },

  create<I extends Exact<DeepPartial<AppearanceFlagBank>, I>>(base?: I): AppearanceFlagBank {
    return AppearanceFlagBank.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<AppearanceFlagBank>, I>>(object: I): AppearanceFlagBank {
    const message = createBaseAppearanceFlagBank();
    message.waypoints = object.waypoints ?? 0;
    return message;
  },
};

function createBaseAppearanceFlagWrite(): AppearanceFlagWrite {
  return { maxTextLength: 0 };
}

export const AppearanceFlagWrite = {
  encode(message: AppearanceFlagWrite, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.maxTextLength !== 0) {
      writer.uint32(8).uint32(message.maxTextLength);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AppearanceFlagWrite {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearanceFlagWrite();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.maxTextLength = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AppearanceFlagWrite {
    return { maxTextLength: isSet(object.maxTextLength) ? Number(object.maxTextLength) : 0 };
  },

  toJSON(message: AppearanceFlagWrite): unknown {
    const obj: any = {};
    message.maxTextLength !== undefined && (obj.maxTextLength = Math.round(message.maxTextLength));
    return obj;
  },

  create<I extends Exact<DeepPartial<AppearanceFlagWrite>, I>>(base?: I): AppearanceFlagWrite {
    return AppearanceFlagWrite.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<AppearanceFlagWrite>, I>>(object: I): AppearanceFlagWrite {
    const message = createBaseAppearanceFlagWrite();
    message.maxTextLength = object.maxTextLength ?? 0;
    return message;
  },
};

function createBaseAppearanceFlagWriteOnce(): AppearanceFlagWriteOnce {
  return { maxTextLengthOnce: 0 };
}

export const AppearanceFlagWriteOnce = {
  encode(message: AppearanceFlagWriteOnce, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.maxTextLengthOnce !== 0) {
      writer.uint32(8).uint32(message.maxTextLengthOnce);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AppearanceFlagWriteOnce {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearanceFlagWriteOnce();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.maxTextLengthOnce = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AppearanceFlagWriteOnce {
    return { maxTextLengthOnce: isSet(object.maxTextLengthOnce) ? Number(object.maxTextLengthOnce) : 0 };
  },

  toJSON(message: AppearanceFlagWriteOnce): unknown {
    const obj: any = {};
    message.maxTextLengthOnce !== undefined && (obj.maxTextLengthOnce = Math.round(message.maxTextLengthOnce));
    return obj;
  },

  create<I extends Exact<DeepPartial<AppearanceFlagWriteOnce>, I>>(base?: I): AppearanceFlagWriteOnce {
    return AppearanceFlagWriteOnce.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<AppearanceFlagWriteOnce>, I>>(object: I): AppearanceFlagWriteOnce {
    const message = createBaseAppearanceFlagWriteOnce();
    message.maxTextLengthOnce = object.maxTextLengthOnce ?? 0;
    return message;
  },
};

function createBaseAppearanceFlagLight(): AppearanceFlagLight {
  return { brightness: 0, color: 0 };
}

export const AppearanceFlagLight = {
  encode(message: AppearanceFlagLight, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.brightness !== 0) {
      writer.uint32(8).uint32(message.brightness);
    }
    if (message.color !== 0) {
      writer.uint32(16).uint32(message.color);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AppearanceFlagLight {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearanceFlagLight();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.brightness = reader.uint32();
          break;
        case 2:
          message.color = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AppearanceFlagLight {
    return {
      brightness: isSet(object.brightness) ? Number(object.brightness) : 0,
      color: isSet(object.color) ? Number(object.color) : 0,
    };
  },

  toJSON(message: AppearanceFlagLight): unknown {
    const obj: any = {};
    message.brightness !== undefined && (obj.brightness = Math.round(message.brightness));
    message.color !== undefined && (obj.color = Math.round(message.color));
    return obj;
  },

  create<I extends Exact<DeepPartial<AppearanceFlagLight>, I>>(base?: I): AppearanceFlagLight {
    return AppearanceFlagLight.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<AppearanceFlagLight>, I>>(object: I): AppearanceFlagLight {
    const message = createBaseAppearanceFlagLight();
    message.brightness = object.brightness ?? 0;
    message.color = object.color ?? 0;
    return message;
  },
};

function createBaseAppearanceFlagHeight(): AppearanceFlagHeight {
  return { elevation: 0 };
}

export const AppearanceFlagHeight = {
  encode(message: AppearanceFlagHeight, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.elevation !== 0) {
      writer.uint32(8).uint32(message.elevation);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AppearanceFlagHeight {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearanceFlagHeight();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.elevation = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AppearanceFlagHeight {
    return { elevation: isSet(object.elevation) ? Number(object.elevation) : 0 };
  },

  toJSON(message: AppearanceFlagHeight): unknown {
    const obj: any = {};
    message.elevation !== undefined && (obj.elevation = Math.round(message.elevation));
    return obj;
  },

  create<I extends Exact<DeepPartial<AppearanceFlagHeight>, I>>(base?: I): AppearanceFlagHeight {
    return AppearanceFlagHeight.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<AppearanceFlagHeight>, I>>(object: I): AppearanceFlagHeight {
    const message = createBaseAppearanceFlagHeight();
    message.elevation = object.elevation ?? 0;
    return message;
  },
};

function createBaseAppearanceFlagShift(): AppearanceFlagShift {
  return { x: 0, y: 0 };
}

export const AppearanceFlagShift = {
  encode(message: AppearanceFlagShift, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.x !== 0) {
      writer.uint32(8).uint32(message.x);
    }
    if (message.y !== 0) {
      writer.uint32(16).uint32(message.y);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AppearanceFlagShift {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearanceFlagShift();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.x = reader.uint32();
          break;
        case 2:
          message.y = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AppearanceFlagShift {
    return { x: isSet(object.x) ? Number(object.x) : 0, y: isSet(object.y) ? Number(object.y) : 0 };
  },

  toJSON(message: AppearanceFlagShift): unknown {
    const obj: any = {};
    message.x !== undefined && (obj.x = Math.round(message.x));
    message.y !== undefined && (obj.y = Math.round(message.y));
    return obj;
  },

  create<I extends Exact<DeepPartial<AppearanceFlagShift>, I>>(base?: I): AppearanceFlagShift {
    return AppearanceFlagShift.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<AppearanceFlagShift>, I>>(object: I): AppearanceFlagShift {
    const message = createBaseAppearanceFlagShift();
    message.x = object.x ?? 0;
    message.y = object.y ?? 0;
    return message;
  },
};

function createBaseAppearanceFlagClothes(): AppearanceFlagClothes {
  return { slot: 0 };
}

export const AppearanceFlagClothes = {
  encode(message: AppearanceFlagClothes, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.slot !== 0) {
      writer.uint32(8).uint32(message.slot);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AppearanceFlagClothes {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearanceFlagClothes();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.slot = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AppearanceFlagClothes {
    return { slot: isSet(object.slot) ? Number(object.slot) : 0 };
  },

  toJSON(message: AppearanceFlagClothes): unknown {
    const obj: any = {};
    message.slot !== undefined && (obj.slot = Math.round(message.slot));
    return obj;
  },

  create<I extends Exact<DeepPartial<AppearanceFlagClothes>, I>>(base?: I): AppearanceFlagClothes {
    return AppearanceFlagClothes.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<AppearanceFlagClothes>, I>>(object: I): AppearanceFlagClothes {
    const message = createBaseAppearanceFlagClothes();
    message.slot = object.slot ?? 0;
    return message;
  },
};

function createBaseAppearanceFlagDefaultAction(): AppearanceFlagDefaultAction {
  return { action: 0 };
}

export const AppearanceFlagDefaultAction = {
  encode(message: AppearanceFlagDefaultAction, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.action !== 0) {
      writer.uint32(8).int32(message.action);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AppearanceFlagDefaultAction {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearanceFlagDefaultAction();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.action = reader.int32() as any;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AppearanceFlagDefaultAction {
    return { action: isSet(object.action) ? playerActionFromJSON(object.action) : 0 };
  },

  toJSON(message: AppearanceFlagDefaultAction): unknown {
    const obj: any = {};
    message.action !== undefined && (obj.action = playerActionToJSON(message.action));
    return obj;
  },

  create<I extends Exact<DeepPartial<AppearanceFlagDefaultAction>, I>>(base?: I): AppearanceFlagDefaultAction {
    return AppearanceFlagDefaultAction.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<AppearanceFlagDefaultAction>, I>>(object: I): AppearanceFlagDefaultAction {
    const message = createBaseAppearanceFlagDefaultAction();
    message.action = object.action ?? 0;
    return message;
  },
};

function createBaseAppearanceFlagMarket(): AppearanceFlagMarket {
  return { category: 1, tradeAsObjectId: 0, showAsObjectId: 0, name: "", restrictToProfession: [], minimumLevel: 0 };
}

export const AppearanceFlagMarket = {
  encode(message: AppearanceFlagMarket, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.category !== 1) {
      writer.uint32(8).int32(message.category);
    }
    if (message.tradeAsObjectId !== 0) {
      writer.uint32(16).uint32(message.tradeAsObjectId);
    }
    if (message.showAsObjectId !== 0) {
      writer.uint32(24).uint32(message.showAsObjectId);
    }
    if (message.name !== "") {
      writer.uint32(34).string(message.name);
    }
    writer.uint32(42).fork();
    for (const v of message.restrictToProfession) {
      writer.int32(v);
    }
    writer.ldelim();
    if (message.minimumLevel !== 0) {
      writer.uint32(48).uint32(message.minimumLevel);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AppearanceFlagMarket {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearanceFlagMarket();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.category = reader.int32() as any;
          break;
        case 2:
          message.tradeAsObjectId = reader.uint32();
          break;
        case 3:
          message.showAsObjectId = reader.uint32();
          break;
        case 4:
          message.name = reader.string();
          break;
        case 5:
          if ((tag & 7) === 2) {
            const end2 = reader.uint32() + reader.pos;
            while (reader.pos < end2) {
              message.restrictToProfession.push(reader.int32() as any);
            }
          } else {
            message.restrictToProfession.push(reader.int32() as any);
          }
          break;
        case 6:
          message.minimumLevel = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AppearanceFlagMarket {
    return {
      category: isSet(object.category) ? itemCategoryFromJSON(object.category) : 1,
      tradeAsObjectId: isSet(object.tradeAsObjectId) ? Number(object.tradeAsObjectId) : 0,
      showAsObjectId: isSet(object.showAsObjectId) ? Number(object.showAsObjectId) : 0,
      name: isSet(object.name) ? String(object.name) : "",
      restrictToProfession: Array.isArray(object?.restrictToProfession)
        ? object.restrictToProfession.map((e: any) => playerProfessionFromJSON(e))
        : [],
      minimumLevel: isSet(object.minimumLevel) ? Number(object.minimumLevel) : 0,
    };
  },

  toJSON(message: AppearanceFlagMarket): unknown {
    const obj: any = {};
    message.category !== undefined && (obj.category = itemCategoryToJSON(message.category));
    message.tradeAsObjectId !== undefined && (obj.tradeAsObjectId = Math.round(message.tradeAsObjectId));
    message.showAsObjectId !== undefined && (obj.showAsObjectId = Math.round(message.showAsObjectId));
    message.name !== undefined && (obj.name = message.name);
    if (message.restrictToProfession) {
      obj.restrictToProfession = message.restrictToProfession.map((e) => playerProfessionToJSON(e));
    } else {
      obj.restrictToProfession = [];
    }
    message.minimumLevel !== undefined && (obj.minimumLevel = Math.round(message.minimumLevel));
    return obj;
  },

  create<I extends Exact<DeepPartial<AppearanceFlagMarket>, I>>(base?: I): AppearanceFlagMarket {
    return AppearanceFlagMarket.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<AppearanceFlagMarket>, I>>(object: I): AppearanceFlagMarket {
    const message = createBaseAppearanceFlagMarket();
    message.category = object.category ?? 1;
    message.tradeAsObjectId = object.tradeAsObjectId ?? 0;
    message.showAsObjectId = object.showAsObjectId ?? 0;
    message.name = object.name ?? "";
    message.restrictToProfession = object.restrictToProfession?.map((e) => e) || [];
    message.minimumLevel = object.minimumLevel ?? 0;
    return message;
  },
};

function createBaseAppearanceFlagNPC(): AppearanceFlagNPC {
  return {
    name: "",
    location: "",
    salePrice: 0,
    buyPrice: 0,
    currencyObjectTypeId: 0,
    currencyQuestFlagDisplayName: "",
  };
}

export const AppearanceFlagNPC = {
  encode(message: AppearanceFlagNPC, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.name !== "") {
      writer.uint32(10).string(message.name);
    }
    if (message.location !== "") {
      writer.uint32(18).string(message.location);
    }
    if (message.salePrice !== 0) {
      writer.uint32(24).uint32(message.salePrice);
    }
    if (message.buyPrice !== 0) {
      writer.uint32(32).uint32(message.buyPrice);
    }
    if (message.currencyObjectTypeId !== 0) {
      writer.uint32(40).uint32(message.currencyObjectTypeId);
    }
    if (message.currencyQuestFlagDisplayName !== "") {
      writer.uint32(50).string(message.currencyQuestFlagDisplayName);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AppearanceFlagNPC {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearanceFlagNPC();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.name = reader.string();
          break;
        case 2:
          message.location = reader.string();
          break;
        case 3:
          message.salePrice = reader.uint32();
          break;
        case 4:
          message.buyPrice = reader.uint32();
          break;
        case 5:
          message.currencyObjectTypeId = reader.uint32();
          break;
        case 6:
          message.currencyQuestFlagDisplayName = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AppearanceFlagNPC {
    return {
      name: isSet(object.name) ? String(object.name) : "",
      location: isSet(object.location) ? String(object.location) : "",
      salePrice: isSet(object.salePrice) ? Number(object.salePrice) : 0,
      buyPrice: isSet(object.buyPrice) ? Number(object.buyPrice) : 0,
      currencyObjectTypeId: isSet(object.currencyObjectTypeId) ? Number(object.currencyObjectTypeId) : 0,
      currencyQuestFlagDisplayName: isSet(object.currencyQuestFlagDisplayName)
        ? String(object.currencyQuestFlagDisplayName)
        : "",
    };
  },

  toJSON(message: AppearanceFlagNPC): unknown {
    const obj: any = {};
    message.name !== undefined && (obj.name = message.name);
    message.location !== undefined && (obj.location = message.location);
    message.salePrice !== undefined && (obj.salePrice = Math.round(message.salePrice));
    message.buyPrice !== undefined && (obj.buyPrice = Math.round(message.buyPrice));
    message.currencyObjectTypeId !== undefined && (obj.currencyObjectTypeId = Math.round(message.currencyObjectTypeId));
    message.currencyQuestFlagDisplayName !== undefined &&
      (obj.currencyQuestFlagDisplayName = message.currencyQuestFlagDisplayName);
    return obj;
  },

  create<I extends Exact<DeepPartial<AppearanceFlagNPC>, I>>(base?: I): AppearanceFlagNPC {
    return AppearanceFlagNPC.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<AppearanceFlagNPC>, I>>(object: I): AppearanceFlagNPC {
    const message = createBaseAppearanceFlagNPC();
    message.name = object.name ?? "";
    message.location = object.location ?? "";
    message.salePrice = object.salePrice ?? 0;
    message.buyPrice = object.buyPrice ?? 0;
    message.currencyObjectTypeId = object.currencyObjectTypeId ?? 0;
    message.currencyQuestFlagDisplayName = object.currencyQuestFlagDisplayName ?? "";
    return message;
  },
};

function createBaseAppearanceFlagAutomap(): AppearanceFlagAutomap {
  return { color: 0 };
}

export const AppearanceFlagAutomap = {
  encode(message: AppearanceFlagAutomap, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.color !== 0) {
      writer.uint32(8).uint32(message.color);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AppearanceFlagAutomap {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearanceFlagAutomap();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.color = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AppearanceFlagAutomap {
    return { color: isSet(object.color) ? Number(object.color) : 0 };
  },

  toJSON(message: AppearanceFlagAutomap): unknown {
    const obj: any = {};
    message.color !== undefined && (obj.color = Math.round(message.color));
    return obj;
  },

  create<I extends Exact<DeepPartial<AppearanceFlagAutomap>, I>>(base?: I): AppearanceFlagAutomap {
    return AppearanceFlagAutomap.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<AppearanceFlagAutomap>, I>>(object: I): AppearanceFlagAutomap {
    const message = createBaseAppearanceFlagAutomap();
    message.color = object.color ?? 0;
    return message;
  },
};

function createBaseAppearanceFlagHook(): AppearanceFlagHook {
  return { south: 1, east: 1 };
}

export const AppearanceFlagHook = {
  encode(message: AppearanceFlagHook, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.south !== 1) {
      writer.uint32(8).int32(message.south);
    }
    if (message.east !== 1) {
      writer.uint32(16).int32(message.east);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AppearanceFlagHook {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearanceFlagHook();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.south = reader.int32() as any;
          break;
        case 2:
          message.east = reader.int32() as any;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AppearanceFlagHook {
    return {
      south: isSet(object.south) ? hookTypeFromJSON(object.south) : 1,
      east: isSet(object.east) ? hookTypeFromJSON(object.east) : 1,
    };
  },

  toJSON(message: AppearanceFlagHook): unknown {
    const obj: any = {};
    message.south !== undefined && (obj.south = hookTypeToJSON(message.south));
    message.east !== undefined && (obj.east = hookTypeToJSON(message.east));
    return obj;
  },

  create<I extends Exact<DeepPartial<AppearanceFlagHook>, I>>(base?: I): AppearanceFlagHook {
    return AppearanceFlagHook.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<AppearanceFlagHook>, I>>(object: I): AppearanceFlagHook {
    const message = createBaseAppearanceFlagHook();
    message.south = object.south ?? 1;
    message.east = object.east ?? 1;
    return message;
  },
};

function createBaseAppearanceFlagLenshelp(): AppearanceFlagLenshelp {
  return { id: 0 };
}

export const AppearanceFlagLenshelp = {
  encode(message: AppearanceFlagLenshelp, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== 0) {
      writer.uint32(8).uint32(message.id);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AppearanceFlagLenshelp {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearanceFlagLenshelp();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AppearanceFlagLenshelp {
    return { id: isSet(object.id) ? Number(object.id) : 0 };
  },

  toJSON(message: AppearanceFlagLenshelp): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = Math.round(message.id));
    return obj;
  },

  create<I extends Exact<DeepPartial<AppearanceFlagLenshelp>, I>>(base?: I): AppearanceFlagLenshelp {
    return AppearanceFlagLenshelp.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<AppearanceFlagLenshelp>, I>>(object: I): AppearanceFlagLenshelp {
    const message = createBaseAppearanceFlagLenshelp();
    message.id = object.id ?? 0;
    return message;
  },
};

function createBaseAppearanceFlagChangedToExpire(): AppearanceFlagChangedToExpire {
  return { formerObjectTypeid: 0 };
}

export const AppearanceFlagChangedToExpire = {
  encode(message: AppearanceFlagChangedToExpire, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.formerObjectTypeid !== 0) {
      writer.uint32(8).uint32(message.formerObjectTypeid);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AppearanceFlagChangedToExpire {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearanceFlagChangedToExpire();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.formerObjectTypeid = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AppearanceFlagChangedToExpire {
    return { formerObjectTypeid: isSet(object.formerObjectTypeid) ? Number(object.formerObjectTypeid) : 0 };
  },

  toJSON(message: AppearanceFlagChangedToExpire): unknown {
    const obj: any = {};
    message.formerObjectTypeid !== undefined && (obj.formerObjectTypeid = Math.round(message.formerObjectTypeid));
    return obj;
  },

  create<I extends Exact<DeepPartial<AppearanceFlagChangedToExpire>, I>>(base?: I): AppearanceFlagChangedToExpire {
    return AppearanceFlagChangedToExpire.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<AppearanceFlagChangedToExpire>, I>>(
    object: I,
  ): AppearanceFlagChangedToExpire {
    const message = createBaseAppearanceFlagChangedToExpire();
    message.formerObjectTypeid = object.formerObjectTypeid ?? 0;
    return message;
  },
};

function createBaseAppearanceFlagCyclopedia(): AppearanceFlagCyclopedia {
  return { cyclopediaType: 0 };
}

export const AppearanceFlagCyclopedia = {
  encode(message: AppearanceFlagCyclopedia, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.cyclopediaType !== 0) {
      writer.uint32(8).uint32(message.cyclopediaType);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AppearanceFlagCyclopedia {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearanceFlagCyclopedia();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.cyclopediaType = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AppearanceFlagCyclopedia {
    return { cyclopediaType: isSet(object.cyclopediaType) ? Number(object.cyclopediaType) : 0 };
  },

  toJSON(message: AppearanceFlagCyclopedia): unknown {
    const obj: any = {};
    message.cyclopediaType !== undefined && (obj.cyclopediaType = Math.round(message.cyclopediaType));
    return obj;
  },

  create<I extends Exact<DeepPartial<AppearanceFlagCyclopedia>, I>>(base?: I): AppearanceFlagCyclopedia {
    return AppearanceFlagCyclopedia.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<AppearanceFlagCyclopedia>, I>>(object: I): AppearanceFlagCyclopedia {
    const message = createBaseAppearanceFlagCyclopedia();
    message.cyclopediaType = object.cyclopediaType ?? 0;
    return message;
  },
};

function createBaseAppearanceFlagSkillWheelGem(): AppearanceFlagSkillWheelGem {
  return { gemQualityId: 0, vocationId: 0 };
}

export const AppearanceFlagSkillWheelGem = {
  encode(message: AppearanceFlagSkillWheelGem, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.gemQualityId !== 0) {
      writer.uint32(8).uint32(message.gemQualityId);
    }
    if (message.vocationId !== 0) {
      writer.uint32(16).uint32(message.vocationId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AppearanceFlagSkillWheelGem {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAppearanceFlagSkillWheelGem();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.gemQualityId = reader.uint32();
          break;
        case 2:
          message.vocationId = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AppearanceFlagSkillWheelGem {
    return {
      gemQualityId: isSet(object.gemQualityId) ? Number(object.gemQualityId) : 0,
      vocationId: isSet(object.vocationId) ? Number(object.vocationId) : 0,
    };
  },

  toJSON(message: AppearanceFlagSkillWheelGem): unknown {
    const obj: any = {};
    message.gemQualityId !== undefined && (obj.gemQualityId = Math.round(message.gemQualityId));
    message.vocationId !== undefined && (obj.vocationId = Math.round(message.vocationId));
    return obj;
  },

  create<I extends Exact<DeepPartial<AppearanceFlagSkillWheelGem>, I>>(base?: I): AppearanceFlagSkillWheelGem {
    return AppearanceFlagSkillWheelGem.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<AppearanceFlagSkillWheelGem>, I>>(object: I): AppearanceFlagSkillWheelGem {
    const message = createBaseAppearanceFlagSkillWheelGem();
    message.gemQualityId = object.gemQualityId ?? 0;
    message.vocationId = object.vocationId ?? 0;
    return message;
  },
};

function createBaseSpecialMeaningAppearanceIds(): SpecialMeaningAppearanceIds {
  return { goldCoinId: 0, platinumCoinId: 0, crystalCoinId: 0, tibiaCoinId: 0, stampedLetterId: 0, supplyStashId: 0 };
}

export const SpecialMeaningAppearanceIds = {
  encode(message: SpecialMeaningAppearanceIds, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.goldCoinId !== 0) {
      writer.uint32(8).uint32(message.goldCoinId);
    }
    if (message.platinumCoinId !== 0) {
      writer.uint32(16).uint32(message.platinumCoinId);
    }
    if (message.crystalCoinId !== 0) {
      writer.uint32(24).uint32(message.crystalCoinId);
    }
    if (message.tibiaCoinId !== 0) {
      writer.uint32(32).uint32(message.tibiaCoinId);
    }
    if (message.stampedLetterId !== 0) {
      writer.uint32(40).uint32(message.stampedLetterId);
    }
    if (message.supplyStashId !== 0) {
      writer.uint32(48).uint32(message.supplyStashId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SpecialMeaningAppearanceIds {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSpecialMeaningAppearanceIds();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.goldCoinId = reader.uint32();
          break;
        case 2:
          message.platinumCoinId = reader.uint32();
          break;
        case 3:
          message.crystalCoinId = reader.uint32();
          break;
        case 4:
          message.tibiaCoinId = reader.uint32();
          break;
        case 5:
          message.stampedLetterId = reader.uint32();
          break;
        case 6:
          message.supplyStashId = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SpecialMeaningAppearanceIds {
    return {
      goldCoinId: isSet(object.goldCoinId) ? Number(object.goldCoinId) : 0,
      platinumCoinId: isSet(object.platinumCoinId) ? Number(object.platinumCoinId) : 0,
      crystalCoinId: isSet(object.crystalCoinId) ? Number(object.crystalCoinId) : 0,
      tibiaCoinId: isSet(object.tibiaCoinId) ? Number(object.tibiaCoinId) : 0,
      stampedLetterId: isSet(object.stampedLetterId) ? Number(object.stampedLetterId) : 0,
      supplyStashId: isSet(object.supplyStashId) ? Number(object.supplyStashId) : 0,
    };
  },

  toJSON(message: SpecialMeaningAppearanceIds): unknown {
    const obj: any = {};
    message.goldCoinId !== undefined && (obj.goldCoinId = Math.round(message.goldCoinId));
    message.platinumCoinId !== undefined && (obj.platinumCoinId = Math.round(message.platinumCoinId));
    message.crystalCoinId !== undefined && (obj.crystalCoinId = Math.round(message.crystalCoinId));
    message.tibiaCoinId !== undefined && (obj.tibiaCoinId = Math.round(message.tibiaCoinId));
    message.stampedLetterId !== undefined && (obj.stampedLetterId = Math.round(message.stampedLetterId));
    message.supplyStashId !== undefined && (obj.supplyStashId = Math.round(message.supplyStashId));
    return obj;
  },

  create<I extends Exact<DeepPartial<SpecialMeaningAppearanceIds>, I>>(base?: I): SpecialMeaningAppearanceIds {
    return SpecialMeaningAppearanceIds.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<SpecialMeaningAppearanceIds>, I>>(object: I): SpecialMeaningAppearanceIds {
    const message = createBaseSpecialMeaningAppearanceIds();
    message.goldCoinId = object.goldCoinId ?? 0;
    message.platinumCoinId = object.platinumCoinId ?? 0;
    message.crystalCoinId = object.crystalCoinId ?? 0;
    message.tibiaCoinId = object.tibiaCoinId ?? 0;
    message.stampedLetterId = object.stampedLetterId ?? 0;
    message.supplyStashId = object.supplyStashId ?? 0;
    return message;
  },
};

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}
