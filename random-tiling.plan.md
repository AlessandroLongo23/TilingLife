proc generate_random:
    Select first polygon at random between {3}, {4}, {6} and {12}
    for n:
        calculate the entropy of the vertices
        collapse the vertex with the least entropy
        add the new vertices to the list of "open" vertices
        propagate the information using a BFS


def calculate_entropy(vertex):
    list all polygons insisting on it
    order them clockwise
    identify gaps
    calculate which vertex types can fit

def collapse(vertex):
    choose one vertex type at random among the availables
    add the polygons

def add_vertices:
    for each new polygon
        for each of its vertices
            if not on an existing vertex
                add it to the list

def propagate(vertex):
    