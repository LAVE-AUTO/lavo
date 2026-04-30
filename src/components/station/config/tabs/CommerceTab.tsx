'use client';

import { StationProfileForm, type StationProfile } from '../StationProfileForm';
import { StationLocationForm, type StationLocation } from '../StationLocationForm';
import { StationPhotosForm } from '../StationPhotosForm';

interface Props {
  profile: StationProfile;
  location: StationLocation;
  locked: boolean;
  onProfileSaved: (profile: StationProfile) => void;
  onLocationSaved: (location: StationLocation) => void;
}

export function CommerceTab({ profile, location, locked, onProfileSaved, onLocationSaved }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <StationProfileForm profile={profile} onSaved={onProfileSaved} locked={locked} />
      <StationPhotosForm locked={locked} />
      <StationLocationForm location={location} onSaved={onLocationSaved} locked={locked} />
    </div>
  );
}
