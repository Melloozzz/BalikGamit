import sky from "../assets/rtu-building.jpg"; // building against the sky

/** Campus photos used behind the blue overlay on public and sign-in pages. Add landscape shots here to vary sections. */
const photos = { sky };

export type CampusPhoto = keyof typeof photos;

/** Decorative background photo for a `.photo-section` (or `.auth`, with className="auth__photo"). */
export function PhotoBg({ photo, className = "photo-section__img" }: { photo: CampusPhoto; className?: string }) {
  return <img src={photos[photo]} alt="" className={`${className} photo--${photo}`} />;
}
