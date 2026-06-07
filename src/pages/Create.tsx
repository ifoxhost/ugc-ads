import { Link } from "react-router-dom";
import videoCreator from "@/assets/sections/video-creator.jpg";
import imageCreator from "@/assets/sections/image-creator.jpg";

const Create = () => {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 bg-black py-20 sm:py-0">
      <div className="max-w-4xl w-full">
        <h1 className="text-[2rem] sm:text-[3rem] md:text-5xl font-tight text-center mb-8 sm:mb-16 text-white">
          What would you like to create?
        </h1>

        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Video Card */}
          <Link
            to="/video"
            className="group relative aspect-[3/4] rounded-2xl sm:rounded-3xl overflow-hidden"
            style={{
              backgroundImage: `url(${videoCreator})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/40 to-red-500/40 group-hover:from-orange-500/50 group-hover:to-red-500/50 transition-all" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <h2 className="text-[2.5rem] sm:text-5xl font-tight font-semibold text-white drop-shadow-lg">
                Video
              </h2>
            </div>
          </Link>

          {/* Image Card */}
          <Link
            to="/image"
            className="group relative aspect-[3/4] rounded-2xl sm:rounded-3xl overflow-hidden"
            style={{
              backgroundImage: `url(${imageCreator})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/40 to-blue-600/40 group-hover:from-blue-500/50 group-hover:to-blue-600/50 transition-all" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <h2 className="text-[2.5rem] sm:text-5xl font-tight font-semibold text-white drop-shadow-lg">
                Image
              </h2>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Create;