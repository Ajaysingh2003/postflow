import Image from "next/image";
import { SiBluesky, SiMastodon } from "@icons-pack/react-simple-icons";
import { cn } from "@/lib/utils";
import type { ChannelConfig } from "../channel-config";

export default function ChannelIcon({ channel, small = false }: { channel: ChannelConfig; small?: boolean }) {
  return (
    <div aria-hidden="true" className={cn("flex shrink-0 items-center justify-center rounded-2xl ring-1 ring-black/[0.03] dark:ring-white/5", small ? "size-10" : "size-14", channel.iconStyle)}>
      {channel.id === "bluesky" ? <SiBluesky size={small ? 21 : 28} /> : channel.id === "mastodon" ? <SiMastodon size={small ? 21 : 28} /> : (
        <Image src={`/channels/${channel.icon}`} width={small ? 22 : 28} height={small ? 22 : 28} alt="" className={cn("object-contain", small ? "size-[22px]" : "size-7", channel.id === "threads" && "dark:invert", channel.id === "x" && "rounded-md")} />
      )}
    </div>
  );
}
