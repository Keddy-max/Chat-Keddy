export const checkTraffic = async (city: string) => {
  const TOMTOM_API_KEY = (import.meta as any).env.VITE_TOMTOM_API_KEY || 'YhgzE0CFK6JmTRe7rcd1613y9K9Rtlv0';
  
  const cityBboxes: Record<string, string> = {
    'Accra': '-0.3,5.5,0.0,5.7',
    'Kumasi': '-1.7,6.6,-1.5,6.8',
    'Tamale': '-0.9,9.3,-0.7,9.5',
    'Takoradi': '-1.8,4.8,-1.6,5.0',
    'Cape Coast': '-1.3,5.0,-1.1,5.2'
  };

  const bbox = cityBboxes[city] || cityBboxes['Accra'];
  
  try {
    const fields = '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code,iconCategory},startTime,endTime,from,to,length,delay,roadNumbers,timeValidity,probabilityOfOccurrence}}}';
    const response = await fetch(`https://api.tomtom.com/traffic/services/5/incidentDetails?key=${TOMTOM_API_KEY}&bbox=${bbox}&fields=${encodeURIComponent(fields)}`);
    const data = await response.json();
    
    if (data && data.incidents && data.incidents.length > 0) {
      const summaries = data.incidents.slice(0, 10).map((inc: any) => {
        const props = inc.properties;
        return `Incident on ${props.roadNumbers?.join(', ') || 'road'} from ${props.from} to ${props.to}. Delay: ${props.delay} seconds. Length: ${props.length} meters. Description: ${props.events?.map((e:any) => e.description).join(', ')}.`;
      });
      return `Traffic incidents in ${city}:\n` + summaries.join('\n');
    } else {
      return `No major traffic incidents reported in ${city} right now. Traffic is flowing relatively smoothly.`;
    }
  } catch (error) {
    console.error("Error fetching traffic:", error);
    return `Could not fetch traffic data for ${city}.`;
  }
};
