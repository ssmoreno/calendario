import { defineTool } from "eve/tools";
import { webFetch } from "eve/tools/defaults";

export default defineTool({ ...webFetch });
