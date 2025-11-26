import networkx as nx
import logging
from typing import Dict, List, Set, Tuple, Any

logger = logging.getLogger(__name__)

class OSPFAnalyzer:
    """
    Analyzes OSPF topology using Shortest Path First (SPF) algorithms.
    Supports "What-If" analysis by comparing baseline and draft topologies.
    """

    def __init__(self, nodes: List[Dict], links: List[Dict]):
        self.nodes = nodes
        self.links = links
        self.graph = self._build_graph(nodes, links)

    def _build_graph(self, nodes: List[Dict], links: List[Dict]) -> nx.DiGraph:
        """Builds a NetworkX DiGraph from topology data."""
        G = nx.DiGraph()
        
        for node in nodes:
            G.add_node(node['id'], **node)
            
        for link in links:
            # OSPF uses directional links with costs
            # Ensure cost is an integer, default to 1 if missing/None
            cost = int(link.get('cost') or 1)
            G.add_edge(link['source'], link['target'], weight=cost, **link)
            
        return G

    def calculate_shortest_paths(self, source: str) -> Dict[str, List[str]]:
        """
        Calculates shortest paths from source to all other nodes.
        Returns: {target_node: [path_nodes]}
        """
        if source not in self.graph:
            return {}
            
        try:
            # Dijkstra's algorithm for weighted shortest paths
            paths = nx.single_source_dijkstra_path(self.graph, source, weight='weight')
            return paths
        except Exception as e:
            logger.error(f"Error calculating SPF for {source}: {e}")
            return {}

    def calculate_all_pairs_shortest_paths(self) -> Dict[str, Dict[str, List[str]]]:
        """
        Calculates shortest paths between ALL pairs of nodes.
        Returns: {source: {target: [path_nodes]}}
        """
        all_paths = {}
        for node in self.graph.nodes():
            all_paths[node] = self.calculate_shortest_paths(node)
        return all_paths

    def analyze_impact(self, baseline_analyzer: 'OSPFAnalyzer') -> Dict[str, Any]:
        """
        Compares this topology (Draft) against a baseline topology.
        Identifies changed paths, impacted regions, and blast radius.
        """
        impact = {
            "changed_paths": [],
            "impacted_nodes": set(),
            "impacted_countries": set(),
            "blast_radius_score": "Low"
        }

        # Calculate all paths for both topologies
        current_paths = self.calculate_all_pairs_shortest_paths()
        baseline_paths = baseline_analyzer.calculate_all_pairs_shortest_paths()

        # Compare paths
        for source, targets in baseline_paths.items():
            if source not in current_paths:
                continue # Node removed?
                
            for target, old_path in targets.items():
                if target == source:
                    continue
                    
                if target not in current_paths[source]:
                    # Path lost (Reachability issue)
                    impact["changed_paths"].append({
                        "source": source,
                        "target": target,
                        "old_path": old_path,
                        "new_path": None,
                        "type": "lost"
                    })
                    impact["impacted_nodes"].add(source)
                    impact["impacted_nodes"].add(target)
                    continue

                new_path = current_paths[source][target]
                
                if old_path != new_path:
                    # Path changed
                    impact["changed_paths"].append({
                        "source": source,
                        "target": target,
                        "old_path": old_path,
                        "new_path": new_path,
                        "type": "changed"
                    })
                    impact["impacted_nodes"].add(source)
                    impact["impacted_nodes"].add(target)
                    
                    # Add intermediate nodes to impacted list
                    for node in set(old_path + new_path):
                        impact["impacted_nodes"].add(node)

        # Resolve Countries
        node_map = {n['id']: n for n in self.nodes}
        for node_id in impact["impacted_nodes"]:
            if node_id in node_map and node_map[node_id].get('country'):
                impact["impacted_countries"].add(node_map[node_id]['country'])

        # Calculate Blast Radius Score
        total_nodes = len(self.nodes)
        impacted_count = len(impact["impacted_nodes"])
        
        if total_nodes > 0:
            percent_impact = (impacted_count / total_nodes) * 100
            if percent_impact > 50:
                impact["blast_radius_score"] = "Critical"
            elif percent_impact > 20:
                impact["blast_radius_score"] = "High"
            elif percent_impact > 5:
                impact["blast_radius_score"] = "Medium"
            elif percent_impact > 0:
                impact["blast_radius_score"] = "Low"
            else:
                impact["blast_radius_score"] = "None"

        # Convert sets to lists for JSON serialization
        impact["impacted_nodes"] = list(impact["impacted_nodes"])
        impact["impacted_countries"] = list(impact["impacted_countries"])
        
        return impact

    def get_blast_radius_visuals(self, changed_links: List[Tuple[str, str]]) -> Dict[str, Any]:
        """
        Returns nodes and links that are part of the blast radius for visualization.
        Starting from changed links, find all affected paths.
        """
        # This is a simplified visualizer - returns sub-graph of affected area
        # For now, we return the full impact analysis result
        return {}
