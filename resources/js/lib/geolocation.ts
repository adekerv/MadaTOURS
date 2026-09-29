import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
export async function deviceLocation() {
  const options = { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 };
  const position = Capacitor.isNativePlatform()
    ? await Geolocation.getCurrentPosition(options)
    : await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('Location unavailable'));
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}
