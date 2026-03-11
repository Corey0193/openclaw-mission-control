import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
	"refresh polymarket prices",
	{ minutes: 5 },
	internal.polymarketActions.refreshPrices,
	{},
);

crons.interval(
	"check arb paper trade resolutions",
	{ minutes: 30 },
	internal.arbPaperTradeActions.checkResolutions,
	{},
);

export default crons;
