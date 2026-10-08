import { SubsonicArtistRef } from "../types/subsonic";

export function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatArtists(artists: SubsonicArtistRef[]) {
  return artists.map(({ name }) => (name)).join(", ")
}

export function formatTags(tags: string[]) {
  return tags.map(tag => tag.slice(0, 1).toUpperCase() + tag.slice(1)).join(", ")
}
