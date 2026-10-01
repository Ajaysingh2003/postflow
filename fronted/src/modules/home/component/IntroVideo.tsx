import React from "react";

const VIDEO_URL =
  "https://media.booksly.online/telegram-cloud-document-5-6114172875441185959.mp4";

export default function IntroVideo() {
  return (
    <div className="mt-6 h-auto w-full py-6 md:mt-8 lg:mt-10 lg:py-12">
      <div className="relative mx-auto">
        <div className="mx-auto max-w-[90%] overflow-hidden rounded-3xl">
          <video
            width="100%"
            height="auto"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/video-poster.png"
            className="h-auto w-full object-cover"
          >
            <source src={VIDEO_URL} type="video/mp4" />
          </video>
        </div>
      </div>
    </div>
  );
}