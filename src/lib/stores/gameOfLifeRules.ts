export const gameOfLifeRules = [
	{
		name: "Conway's Game of Life",
		rule: "B3/S23",
		description: "Classic Game of Life where cells survive with 2-3 neighbors and are born with exactly 3 neighbors."
	},
	{
		name: "Conway's Game of Life (5 Generations)",
		rule: "B3/S23/G5",
		description: "Classic Conway's rules with 5 generations of cell states before death."
	},
	{
		name: "HighLife",
		rule: "B36/S23",
		description: "Similar to Conway's rules, but cells are also born with 6 neighbors. Features interesting replicators."
	},
	{
		name: "HighLife (4 Generations)",
		rule: "B36/S23/G4",
		description: "HighLife rules with 4 generations of cell states before death."
	},
	{
		name: "Life without Death",
		rule: "B3/S012345678",
		description: "Cells are born with 3 alive neighbors. Once alive, cells never die."
	},
	{
		name: "Maze",
		rule: "B3/S12345",
		description: "Cells are born with 3 neighbors and survive with 1-2 neighbors. Creates maze-like patterns with 8 generations."
	},
	{
		name: "Gnarl",
		rule: "B1/S1/G10",
		description: "Minimalistic rule where cells are born and survive with exactly 1 neighbor. Creates complex branching patterns with 10 generations."
	},
	{
		name: "Seeds",
		rule: "B2/S",
		description: "Cells are born with exactly 2 neighbors and always die in the next generation."
	},
	{
		name: "Replicator",
		rule: "B1357/S1357",
		description: "Edward Fredkin's replicating automaton: every pattern is eventually replaced by multiple copies of itself."
	},
	{
		name: "Anneal",
		rule: "B4678/S35678",
		description: "Also called the twisted majority rule. Symmetric under on-off reversal. Approximates the curve-shortening flow on the boundaries between live and dead cells"
	},
	{
		name: "Bosco's Rule",
		rule: "R5,C2,S33-57,B34-45",
		description: ""
	},
	{
		name: "Waffle",
		rule: "R7,C2,S99-199,B75-170",
		description: ""
	},
	{
		name: "Majorly",
		rule: "R7,C2,S112-224,B113-225",
		description: ""
	},
	{
		name: "Globe",
		rule: "R8,C2,S163-223,B74-252",
		description: ""
	},
	{
		name: "Bugsmovie",
		rule: "R10,C2,S122-211,B123-170",
		description: ""
	},
	{
		name: "Modern Art",
		rule: "R10,C255,S1-2,B3",
		description: ""
	}
]; 