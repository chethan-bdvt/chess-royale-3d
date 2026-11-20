import { Platform } from 'react-native';

export type RewardResult = 'earned' | 'closed' | 'unavailable';

export async function showRewardedHint(): Promise<RewardResult> {
  try {
    const ads = await import('react-native-google-mobile-ads');
    const configuredId = Platform.select({
      android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID,
      ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS,
    });
    const unitId = __DEV__ ? ads.TestIds.REWARDED : configuredId;
    if (!unitId) return 'unavailable';
    const rewarded = ads.RewardedAd.createForAdRequest(unitId, { requestNonPersonalizedAdsOnly: true });
    return await new Promise<RewardResult>((resolve) => {
      let earned = false;
      const cleanups = [
        rewarded.addAdEventListener(ads.RewardedAdEventType.LOADED, () => rewarded.show()),
        rewarded.addAdEventListener(ads.RewardedAdEventType.EARNED_REWARD, () => { earned = true; }),
        rewarded.addAdEventListener(ads.AdEventType.CLOSED, () => { cleanups.forEach((fn) => fn()); resolve(earned ? 'earned' : 'closed'); }),
        rewarded.addAdEventListener(ads.AdEventType.ERROR, () => { cleanups.forEach((fn) => fn()); resolve('unavailable'); }),
      ];
      rewarded.load();
    });
  } catch {
    return 'unavailable';
  }
}
